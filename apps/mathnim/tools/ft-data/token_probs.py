"""Per-token probabilities of real chat samples under Qwen2.5-0.5B (base), for
the `token_loss_mask` visual (B1 "who pays the loss", B2 tool-call mask).

For every token y_t of a sample rendered with the Qwen2.5 chat template, the
base model's next-token distribution p_t (given the tokens before it) gives
  loss  = -log p_t(y_t)
  gnorm = || softmax(z_t) - onehot(y_t) ||   (size of the gradient at the logits),
both computed exactly over the whole vocabulary. Each token also gets the part
of the conversation it belongs to (template / system / user / assistant /
tool result), from the template's own rendering of each message.

Output: packages/visuals/src/ft/b/token_data.ts
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE, INSTRUCT, VIS_B, fetch, sig, ts_module  # noqa: E402

import torch  # noqa: E402
from transformers import AutoModelForCausalLM, AutoTokenizer  # noqa: E402

SYSTEM_SUPPORT = (
    "You are the support assistant for Northwind Bikes. Follow these rules. "
    "1. Answer only questions about orders, shipping, returns and warranty. "
    "2. Be brief: at most two sentences. "
    "3. Never promise refunds; say that a human agent will review the request. "
    "4. Order numbers look like NW-123456; ask for one if it is missing. "
    "5. Shipping within the EU takes 3-5 working days; outside the EU it takes 7-14 working days. "
    "6. Returns are accepted within 30 days if the bike is unused and in its original box. "
    "7. The warranty covers frames for 5 years and parts for 2 years; it does not cover wear such as tyres, chains and brake pads. "
    "8. Reply in the language of the customer. "
    "9. If the customer is upset, apologise once and then give the facts. "
    "10. Do not discuss competitors or the prices of other shops."
)

SAMPLES = {
    "single": {
        "messages": [
            {"role": "system", "content": SYSTEM_SUPPORT},
            {"role": "user", "content": "Hi, I ordered a bike last week (NW-482913) and it still hasn't shipped. I live in Lyon. When will it arrive, and can I return it if I don't like it?"},
            {"role": "assistant", "content": "Within the EU, delivery takes 3-5 working days after shipping. You can return it within 30 days if it is unused and in its original box."},
        ],
    },
    "multiturn": {
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "What is the capital of Australia?"},
            {"role": "assistant", "content": "Canberra."},
            {"role": "user", "content": "Is it closer to the Pacific or the Indian Ocean?"},
            {"role": "assistant", "content": "The Pacific: Canberra lies in the south-east, inland from the Pacific coast."},
        ],
    },
    "tool_call": {
        "tools": [{
            "type": "function",
            "function": {
                "name": "search_trains",
                "description": "Search high-speed trains by origin, destination and date",
                "parameters": {
                    "type": "object",
                    "properties": {"from": {"type": "string"}, "to": {"type": "string"}, "date": {"type": "string"}},
                    "required": ["from", "to", "date"],
                },
            },
        }],
        "messages": [
            {"role": "system", "content": "You are a train booking assistant."},
            {"role": "user", "content": "When is the first high-speed train from Shanghai to Beijing tomorrow?"},
            {"role": "assistant", "content": "", "tool_calls": [{"type": "function", "function": {
                "name": "search_trains", "arguments": {"from": "Shanghai", "to": "Beijing", "date": "2026-10-11"}}}]},
            {"role": "tool", "name": "search_trains", "content": "[{\"train\": \"G2\", \"dep\": \"07:00\"}]"},
            {"role": "assistant", "content": "The first one is G2, leaving at 07:00."},
        ],
    },
}

# role codes stored per token: T template, S system (incl. tool schema), U user, A assistant (incl. its <|im_end|>), R tool result
ROLE_CODE = {"system": "S", "user": "U", "assistant": "A", "tool": "R"}


def render(tok, messages, tools):
    return tok.apply_chat_template(messages, tools=tools, tokenize=False) if tools else tok.apply_chat_template(messages, tokenize=False)


def spans(tok, sample):
    """Character spans of each message in the full rendering: (start, end, role, header_end, content_end)."""
    msgs, tools = sample["messages"], sample.get("tools")
    full = render(tok, msgs, tools)
    out, prev = [], ""
    for i in range(len(msgs)):
        text = render(tok, msgs[: i + 1], tools)
        assert text.startswith(prev), "prefix rendering is not monotone"
        start, end = len(prev), len(text)
        seg = text[start:end]
        # header: "<|im_start|>role\n"; footer: "<|im_end|>\n"
        h = seg.find("\n", seg.find("<|im_start|>")) + 1 if "<|im_start|>" in seg else 0
        f = seg.rfind("<|im_end|>")
        out.append((start, end, msgs[i]["role"], start + h, start + (f if f >= 0 else len(seg))))
        prev = text
    assert prev == full
    return full, out


def classify(char_start, char_end, msg_spans):
    for (s, e, role, h_end, c_end) in msg_spans:
        if s <= char_start < e:
            if char_start < h_end:
                return "T"
            if char_start < c_end:
                return ROLE_CODE[role]
            # the <|im_end|> that closes an assistant turn is trained (assistant-only loss keeps it)
            if role == "assistant" and char_start == c_end:
                return "A"
            return "T"
    return "T"


def main():
    tok_path = fetch(INSTRUCT)  # the chat template lives in the Instruct tokenizer (same vocabulary as the base)
    base_path = fetch(BASE)
    tok = AutoTokenizer.from_pretrained(tok_path)
    model = AutoModelForCausalLM.from_pretrained(base_path, torch_dtype=torch.float32)
    model.eval()
    out = {}
    for name, sample in SAMPLES.items():
        full, msg_spans = spans(tok, sample)
        enc = tok(full, return_offsets_mapping=True, add_special_tokens=False)
        ids = enc["input_ids"]
        with torch.no_grad():
            logits = model(torch.tensor([ids])).logits[0].double()
        probs = torch.softmax(logits, dim=-1)
        rows = []
        for t, (a, b) in enumerate(enc["offset_mapping"]):
            text = full[a:b]
            role = classify(a, b, msg_spans)
            if t == 0:
                rows.append({"s": text, "r": role, "l": None, "g": None})
                continue
            p = probs[t - 1]
            py = float(p[ids[t]])
            g = float(torch.sqrt(torch.clamp(1 - 2 * py + (p * p).sum(), min=0)))
            rows.append({"s": text, "r": role, "l": sig(-torch.log(p[ids[t]]).item()), "g": sig(g, 3)})
        out[name] = rows
        tot = {}
        for r in rows:
            if r["l"] is not None:
                tot.setdefault(r["r"], [0.0, 0])
                tot[r["r"]][0] += r["l"]
                tot[r["r"]][1] += 1
        print(name, len(rows), "tokens;", {k: (round(v[0], 1), v[1], round(v[0] / v[1], 2)) for k, v in tot.items()})
    types = """
export interface TokenRow { s: string; r: 'T' | 'S' | 'U' | 'A' | 'R'; l: number | null; g: number | null }
type TOKEN_SAMPLES_T = Record<'single' | 'multiturn' | 'tool_call', TokenRow[]>;
"""
    ts_module(
        VIS_B / "token_data.ts",
        """Real per-token data for token_loss_mask: three chat samples rendered with the
Qwen2.5 chat template, scored by Qwen2.5-0.5B (base). s = token text, r = part
(T template, S system, U user, A assistant incl. its closing <|im_end|>, R tool
result), l = -log p(token | prefix), g = |softmax(z) - onehot| at that position
(exact, full vocabulary). Source: apps/mathnim/tools/ft-data/token_probs.py""",
        {"TOKEN_SAMPLES": out},
        types,
    )


if __name__ == "__main__":
    main()
