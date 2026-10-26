// Styles for the lesson UI. Colours are CSS variables so a theme (or the
// host page) can restyle everything; the defaults are the quiet white theme.
export const CSS = `
.mn-nowrap{white-space:nowrap}
.mn-app{--mn-bg:#fbfbfa;--mn-fg:#15171a;--mn-muted:#6b7077;--mn-faint:#e7e7e3;--mn-panel:#ffffff;--mn-border:#e3e3de;
 --mn-accent:#2f5bd3;--mn-good:#1f8a5b;--mn-bad:#c2412d;--mn-warn:#b7791f;--mn-radius:14px;--mn-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 28px rgba(0,0,0,.06);
 --mn-code-bg:#f6f7f9;--mn-purple:#7c3aed;
 font:15px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",sans-serif;color:var(--mn-fg);background:var(--mn-bg);
 display:grid;grid-template-columns:minmax(0,1fr) 360px;grid-template-rows:auto auto 1fr;gap:16px;padding:16px;box-sizing:border-box;min-height:100%}
.mn-app *{box-sizing:border-box}
.mn-app.mn-dark{--mn-code-bg:#161a20;--mn-purple:#b69cff;--mn-bg:#0d0f12;--mn-fg:#eef1f6;--mn-muted:#8d96a6;--mn-faint:#232830;--mn-panel:#14171c;--mn-border:#262b33;--mn-accent:#8fb0ff;--mn-good:#5fd3a2;--mn-bad:#ff8a73;--mn-shadow:none}
.mn-head{grid-column:1/-1;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.mn-title{font-size:20px;font-weight:600;letter-spacing:-.01em}
.mn-sub{color:var(--mn-muted);font-size:13px}
.mn-stage{position:relative;aspect-ratio:16/9;border-radius:var(--mn-radius);overflow:hidden;box-shadow:var(--mn-shadow);background:linear-gradient(#fff,#f5f5f7)}
.mn-app.mn-dark .mn-stage{background:#101318}
.mn-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.mn-stage canvas:focus-visible{outline:3px solid var(--mn-accent);outline-offset:-3px}
.mn-sketch{cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M17 2l5 5L8 21l-6 1 1-6z' fill='%23fff' stroke='%23111' stroke-width='1.5'/%3E%3C/svg%3E") 2 22,crosshair;touch-action:none}
/* subtitles sit under the figure, never over it */
.mn-caption{min-height:46px;margin:-2px 0 -4px;padding:0 8px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:16px;line-height:1.4;color:var(--mn-fg);transition:opacity .25s}
.mn-caption:empty{opacity:0}
.mn-caption.offstage{display:none}
/* two columns: the panel shows the narration, so the subtitle strip is only for narrow screens */
@media (min-width:901px){.mn-caption{display:none}}
.mn-cue{transition:color .3s}.mn-cue.next{color:var(--mn-muted)}
.mn-finding{margin-top:8px;padding:8px 10px;border-radius:10px;background:color-mix(in srgb,var(--mn-warn) 12%,transparent);color:var(--mn-fg);font-size:14px}
.mn-stars{margin-left:6px;color:var(--mn-warn);letter-spacing:1px}
.mn-toast{position:absolute;top:14px;left:50%;transform:translateX(-50%);white-space:nowrap;max-width:94%;overflow:hidden;text-overflow:ellipsis;padding:8px 16px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.18);background:var(--mn-good);color:#fff;
 font-weight:600;font-size:14px;opacity:0;transition:opacity .3s;pointer-events:none}
.mn-toast.show{opacity:1}
.mn-toast.info{background:var(--mn-fg);color:var(--mn-bg)}
.mn-side{grid-row:2/4;grid-column:2;background:var(--mn-panel);border:1px solid var(--mn-border);border-radius:var(--mn-radius);padding:18px;
 display:flex;flex-direction:column;gap:14px;box-shadow:var(--mn-shadow);min-height:0;overflow:auto}
.mn-kicker{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--mn-muted)}
.mn-prompt{font-size:17px;line-height:1.45}
.mn-scrub{display:inline-block;min-width:2.2em;padding:0 3px;border-bottom:2px dashed var(--mn-accent);color:var(--mn-accent);font-weight:600;font-variant-numeric:tabular-nums;cursor:ew-resize;user-select:none;touch-action:none;text-align:center;border-radius:3px}
.mn-scrub:hover,.mn-scrub.active,.mn-scrub:focus-visible{background:color-mix(in srgb,var(--mn-accent) 12%,transparent);outline:none}
.mn-choices{display:flex;flex-direction:column;gap:8px}
.mn-choice{text-align:left;padding:10px 12px;border:1px solid var(--mn-border);border-radius:10px;background:transparent;color:inherit;font:inherit;cursor:pointer;display:flex;gap:10px;align-items:center}
.mn-choice:hover{border-color:var(--mn-accent)}
.mn-choice[aria-pressed=true]{border-color:var(--mn-accent);box-shadow:inset 0 0 0 1px var(--mn-accent)}
.mn-choice.good{border-color:var(--mn-good);box-shadow:inset 0 0 0 1px var(--mn-good)}
.mn-choice.bad{border-color:var(--mn-bad);box-shadow:inset 0 0 0 1px var(--mn-bad)}
.mn-choice .mn-key{width:22px;height:22px;border-radius:6px;background:var(--mn-faint);display:grid;place-items:center;font-size:12px;flex:none}
.mn-input{box-sizing:border-box;width:100%;padding:10px 12px;border:1px solid var(--mn-border);border-radius:10px;font:inherit;font-size:17px;background:transparent;color:inherit}
.mn-input:focus{outline:none;border-color:var(--mn-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--mn-accent) 20%,transparent)}
.mn-preview{min-height:24px;color:var(--mn-muted);font-size:14px}
.mn-help{font-size:12px;color:var(--mn-muted)}
.mn-actions{display:flex;gap:8px;flex-wrap:wrap}
.mn-btn{padding:9px 14px;border-radius:10px;border:1px solid var(--mn-border);background:transparent;color:inherit;font:inherit;font-weight:500;cursor:pointer}
.mn-btn:hover{border-color:var(--mn-fg)}
.mn-btn.primary{background:var(--mn-fg);color:var(--mn-bg);border-color:var(--mn-fg)}
.mn-btn:disabled{opacity:.4;cursor:default}
.mn-feedback{border-radius:10px;padding:10px 12px;font-size:14px;display:none}
.mn-feedback.good{display:block;background:color-mix(in srgb,var(--mn-good) 10%,transparent);color:var(--mn-good)}
.mn-feedback.bad{display:block;background:color-mix(in srgb,var(--mn-bad) 9%,transparent);color:var(--mn-bad)}
.mn-feedback.info{display:block;background:var(--mn-faint);color:var(--mn-fg)}
.mn-feedback p{margin:0 0 4px}.mn-feedback p:last-child{margin:0}
/* an auto-advancing question: the options fade out, the feedback is said in their place, the next step fades in */
.mn-choices.mn-leaving{animation:mn-leave .35s ease forwards;pointer-events:none}
@keyframes mn-leave{to{opacity:0;transform:translateY(-4px);height:0;margin:0;overflow:hidden}}
.mn-feedback.mn-say{display:block;background:none;padding:6px 4px;text-align:center;font-size:17px;line-height:1.65;color:var(--mn-fg);cursor:pointer;animation:mn-say .5s ease .3s both}
.mn-feedback.mn-say p{margin:0 0 6px}
.mn-feedback.mn-say p:first-child:not(:last-child){color:var(--mn-good);font-weight:600}
@keyframes mn-say{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.mn-enter .mn-pagehost,.mn-enter .mn-side{animation:mn-enter .7s ease both}
@keyframes mn-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.mn-choices.mn-leaving{animation:none;display:none}.mn-feedback.mn-say,.mn-enter .mn-pagehost,.mn-enter .mn-side{animation:none}}
.mn-hints{display:flex;flex-direction:column;gap:6px;font-size:14px}
.mn-hint{padding:8px 10px;border-left:3px solid var(--mn-warn);background:color-mix(in srgb,var(--mn-warn) 8%,transparent);border-radius:0 8px 8px 0}
.mn-conf{display:flex;gap:6px;align-items:center;font-size:13px;color:var(--mn-muted)}
.mn-conf button{padding:5px 10px;border-radius:999px;border:1px solid var(--mn-border);background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer}
.mn-conf button[aria-pressed=true]{background:var(--mn-fg);color:var(--mn-bg);border-color:var(--mn-fg)}
.mn-bar{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--mn-muted)}.mn-bar>span{white-space:nowrap}
.mn-bar input[type=range]{flex:1;min-width:0;accent-color:var(--mn-accent)}
.mn-bar select{font:inherit;color:inherit;background:transparent;border:1px solid var(--mn-border);border-radius:8px;padding:3px 6px}
.mn-iconbtn{width:34px;height:34px;border-radius:50%;border:1px solid var(--mn-border);background:var(--mn-panel);color:var(--mn-fg);cursor:pointer;display:grid;place-items:center;flex:none}
.mn-steps{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
.mn-dot{width:20px;height:20px;border-radius:50%;background:var(--mn-faint);color:var(--mn-muted);border:0;padding:0;cursor:pointer;display:grid;place-items:center;transition:transform .15s}
.mn-dot:hover{transform:scale(1.12)}
.mn-dot.done{background:color-mix(in srgb,var(--mn-muted) 35%,var(--mn-faint));color:var(--mn-bg)}
.mn-dot.now{background:var(--mn-accent);color:#fff;transform:scale(1.18)}
.mn-dot.mn-explore:not(.now),.mn-dot.mn-sketch:not(.now){box-shadow:inset 0 0 0 1.5px var(--mn-accent);color:var(--mn-accent)}
.mn-yourturn{border:1.5px solid var(--mn-accent);background:color-mix(in srgb,var(--mn-accent) 6%,transparent);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.mn-yt-head{display:flex;align-items:center;gap:8px;font-weight:700;color:var(--mn-accent);font-size:13px;text-transform:uppercase;letter-spacing:.06em}
.mn-yt-icon{width:24px;height:24px;border-radius:50%;background:var(--mn-accent);color:#fff;display:grid;place-items:center;animation:mn-bob 1.6s ease-in-out infinite}
.mn-yourturn.done{border-color:var(--mn-good);background:color-mix(in srgb,var(--mn-good) 7%,transparent)}
.mn-yourturn.done .mn-yt-head{color:var(--mn-good)}.mn-yourturn.done .mn-yt-icon{background:var(--mn-good);animation:none}
.mn-legend{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--mn-muted)!important;margin-top:4px!important}
.mn-sw{display:inline-block;width:18px;height:0;border-top:3px solid var(--mn-accent);margin-left:6px}.mn-sw.real{border-top:3px dashed #1f8a5b}
.mn-goal{font-weight:600;color:var(--mn-good)}
@keyframes mn-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.mn-chapter{font-size:12px;color:var(--mn-muted);margin-left:6px}
.mn-mastery{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--mn-border);padding-top:12px;margin-top:auto}
.mn-skill{display:grid;grid-template-columns:1fr 44px;gap:4px 8px;font-size:13px;align-items:center}
.mn-skill .mn-meter{grid-column:1/-1;height:6px;border-radius:3px;background:var(--mn-faint);overflow:hidden}
.mn-skill .mn-meter i{display:block;height:100%;background:var(--mn-accent);transition:width .6s}
.mn-skill.mastered .mn-meter i{background:var(--mn-good)}
.mn-dev{grid-column:1/-1;font:12px/1.5 ui-monospace,monospace;background:var(--mn-panel);border:1px dashed var(--mn-border);border-radius:10px;padding:10px;white-space:pre-wrap;max-height:260px;overflow:auto}
.mn-dev .error{color:var(--mn-bad)}.mn-dev .warning{color:var(--mn-warn)}
.mn-math svg{vertical-align:middle}
@media (max-width:900px){.mn-app{grid-template-columns:minmax(0,1fr)}.mn-side{grid-row:auto;grid-column:1}}
@media (max-width:640px){.mn-app{padding:0;gap:12px}.mn-title{font-size:18px}.mn-bar .mn-more{display:none}.mn-bar{gap:8px}}
/* ---- game view: a character speaks above a full-width stage, levels with stars, a tray below */
.mn-app.mn-game{grid-template-columns:minmax(0,1fr)}
.mn-game .mn-side{grid-row:auto;grid-column:1}
/* the character, the stage and the tray fit on one screen: the stage gives up width when the window is short */
.mn-game .mn-stage{width:min(100%,calc((100vh - 440px) * 16 / 9));min-width:min(100%,560px);margin:0 auto}
.mn-game .mn-side{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);grid-auto-flow:row dense;gap:6px 28px;align-items:start}
.mn-game .mn-side>*{grid-column:2}
.mn-game .mn-side>.mn-kicker{grid-column:1;grid-row:1}
.mn-game .mn-side>.mn-prompt{grid-column:1;grid-row:1/span 9;margin-top:26px;font-size:19px}
.mn-game .mn-mastery{display:none}
.mn-hud{display:flex;align-items:flex-end;justify-content:space-between;gap:16px}
.mn-speaker{display:flex;align-items:flex-end;gap:12px;flex:1;min-width:0}
.mn-avatar{width:56px;height:56px;border-radius:50%;background:var(--mn-panel);box-shadow:var(--mn-shadow);border:1px solid var(--mn-border);display:grid;place-items:center;font-size:32px;flex:none}
.mn-bubble{position:relative;background:var(--mn-panel);border:1px solid var(--mn-border);border-radius:18px 18px 18px 4px;padding:10px 16px;box-shadow:var(--mn-shadow);min-height:56px;flex:1;min-width:0}
.mn-who{font-size:12px;font-weight:600;color:var(--mn-accent);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
.mn-game .mn-caption{display:block!important;min-height:0;margin:0;padding:0;text-align:left;font-size:17px;line-height:1.45;opacity:1}
.mn-game .mn-caption:empty::before{content:'…';color:var(--mn-muted)}
.mn-hud-tools{display:flex;align-items:center;gap:10px}
.mn-stars-total{font-weight:700;color:var(--mn-warn);font-size:17px;white-space:nowrap}
.mn-of{color:var(--mn-muted);font-weight:500;font-size:13px}
.mn-game .mn-steps{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center}
.mn-level{display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:var(--mn-panel);border:1px solid var(--mn-border)}
.mn-level-name{display:none}
.mn-level.now .mn-level-name{display:inline;font-size:12px;color:var(--mn-fg);font-weight:600;margin-right:2px}
.mn-node{width:14px;height:14px;border-radius:50%;border:none;background:var(--mn-faint);padding:0;cursor:pointer}
.mn-node.world{width:30px;height:30px;border-radius:9px;background:color-mix(in srgb,var(--mn-accent) 12%,transparent);color:var(--mn-warn);font-size:9px;line-height:1;letter-spacing:-1px}
.mn-node.done{background:var(--mn-accent)}
.mn-node.world.done{background:color-mix(in srgb,var(--mn-accent) 28%,transparent)}
.mn-node.now{outline:3px solid color-mix(in srgb,var(--mn-accent) 45%,transparent);outline-offset:2px}
.mn-node.locked{opacity:.35;cursor:not-allowed}
.mn-levelup{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:color-mix(in srgb,var(--mn-bg) 86%,transparent);backdrop-filter:blur(6px);z-index:3}
.mn-levelup.show{display:flex;animation:mn-fade .3s ease-out}
.mn-lu-title{font-size:30px;font-weight:700;letter-spacing:-.01em}
.mn-lu-stars span{font-size:56px;color:var(--mn-faint);display:inline-block;margin:0 4px}
.mn-lu-stars span.on{color:#F5B301;animation:mn-star .5s both cubic-bezier(.2,1.6,.4,1)}
.mn-lu-total{display:flex;align-items:center;gap:10px;font-size:44px;font-weight:700}
.mn-lu-total .mn-lu-star{color:#F5B301;font-size:52px;animation:mn-star .5s both cubic-bezier(.2,1.6,.4,1)}
.mn-lu-total .mn-of{font-size:20px;font-weight:500;color:var(--mn-muted)}
.mn-lu-msg{font-size:17px;max-width:70%;text-align:center}
@keyframes mn-star{from{transform:scale(0) rotate(-40deg);opacity:0}to{transform:none;opacity:1}}
@keyframes mn-fade{from{opacity:0}to{opacity:1}}
@media (max-width:900px){.mn-game .mn-side{grid-template-columns:minmax(0,1fr)}.mn-game .mn-side>*{grid-column:1!important;grid-row:auto!important}.mn-avatar{width:44px;height:44px;font-size:26px}}
/* ---- text pages: read, derive, code (a reading column instead of the stage) */
.mn-page{display:none}
.mn-textstep .mn-page,.mn-casestep .mn-page{display:block}
.mn-nostage .mn-stage,.mn-nostage .mn-bar,.mn-textstep:not(.mn-game) .mn-caption{display:none!important}
/* a question (or world) without a figure: no empty left column, the panel becomes a centred card */
.mn-app.mn-nostage:not(.mn-textstep):not(.mn-casestep):not(.mn-game){grid-template-columns:minmax(0,1fr)}
.mn-app.mn-nostage:not(.mn-textstep):not(.mn-casestep):not(.mn-game) .mn-side{grid-column:1;grid-row:auto;width:100%;max-width:46rem;margin:0 auto}
.mn-textstep .mn-side>:empty{display:none}
.mn-textstep .mn-side,.mn-casestep .mn-side{position:sticky;top:calc(var(--mn-sticky-top,0px) + 12px);max-height:calc(100vh - var(--mn-sticky-top,0px) - 24px);align-self:start}
/* an app element in the side column (rail): on text pages it is all the side holds, the way on ends the page */
.mn-textstep .mn-side.mn-railed{background:none;border:0;box-shadow:none;padding:0;overflow:visible;max-height:none}
.mn-textstep .mn-side.mn-railed>:not(.mn-rail){display:none}
.mn-page-next{display:flex;justify-content:flex-end;margin-top:14px}
.mn-page{background:var(--mn-panel);border:1px solid var(--mn-border);border-radius:var(--mn-radius);box-shadow:var(--mn-shadow);padding:clamp(18px,4vw,44px) clamp(16px,4.5vw,52px);font-size:17px;line-height:1.7;color:var(--mn-fg);min-width:0}
.mn-page:lang(zh){line-height:1.85;letter-spacing:.01em}
.mn-read>*,.mn-derive>*,.mn-case>*{max-width:42rem;margin-left:auto;margin-right:auto}
.mn-codepage>.mn-page-head,.mn-codepage>.mn-prose{max-width:46rem}
.mn-page-head{margin-bottom:20px}
.mn-page-kicker{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--mn-accent);font-weight:600}
.mn-page-title{font-size:clamp(23px,3vw,30px);line-height:1.25;letter-spacing:-.015em;margin:6px 0 4px;font-weight:700}
.mn-page-meta{font-size:13px;color:var(--mn-muted)}
.mn-prose h2{font-size:21px;line-height:1.35;margin:1.7em 0 .5em;letter-spacing:-.01em}
.mn-prose h3{font-size:17.5px;line-height:1.4;margin:1.4em 0 .4em}
.mn-prose>:first-child{margin-top:0}
.mn-prose p{margin:0 0 1em}
.mn-page a{color:var(--mn-accent);text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
.mn-page :not(pre)>code{font:.86em/1.4 ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;background:var(--mn-code-bg);border:1px solid var(--mn-border);border-radius:5px;padding:.06em .35em;word-break:break-word}
.mn-list{padding-left:1.4em;margin:0 0 1em}.mn-list li{margin:.3em 0}.mn-list li::marker{color:var(--mn-muted)}
.mn-dmath{display:flex;align-items:center;gap:12px;margin:1.1em 0;overflow-x:auto;overflow-y:hidden;padding:4px 0}
.mn-dmath-tex{flex:1;min-width:max-content}
/* a formula wider than the column even when scaled down scrolls sideways, faded where it goes on */
.mn-dmath,.mn-dtex{scrollbar-width:thin}
.mn-scrolls:not(.mn-at-end){-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 36px),transparent);mask-image:linear-gradient(to right,#000 calc(100% - 36px),transparent)}.mn-eqlabel{color:var(--mn-muted);font-size:14px;flex:none}
/* code blocks: one panel per tab, a copy button, highlighted tokens */
.mn-codeblock{margin:1.3em 0;border:1px solid var(--mn-border);border-radius:12px;background:var(--mn-code-bg);overflow:hidden}
.mn-code-head{display:flex;align-items:center;gap:8px;min-height:38px;padding:4px 6px 4px 12px;border-bottom:1px solid var(--mn-border);font-size:12px;color:var(--mn-muted);line-height:1.3}
.mn-code-lang{font-weight:600;letter-spacing:.04em;text-transform:uppercase;font-size:11px}
.mn-copy{margin-left:auto;border:1px solid var(--mn-border);background:var(--mn-panel);color:var(--mn-fg);border-radius:8px;padding:4px 10px;font:inherit;font-size:12.5px;cursor:pointer;flex:none}
.mn-copy:hover{border-color:var(--mn-fg)}.mn-copy.mn-copied{color:var(--mn-good);border-color:var(--mn-good)}
.mn-tabs{display:flex;gap:2px;flex-wrap:wrap}
.mn-tab{border:0;background:transparent;padding:5px 11px;border-radius:7px;font:inherit;font-size:12.5px;color:var(--mn-muted);cursor:pointer}
.mn-tab:hover{color:var(--mn-fg)}
.mn-tab[aria-selected=true]{background:var(--mn-panel);color:var(--mn-fg);box-shadow:0 0 0 1px var(--mn-border);font-weight:600}
.mn-code{margin:0;padding:12px 0;overflow:auto;font:13.5px/1.6 ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;tab-size:4;color:var(--mn-fg);letter-spacing:0}
.mn-code code{display:block;min-width:max-content;font:inherit}
.mn-code:focus-visible,.mn-table-wrap:focus-visible{outline:3px solid color-mix(in srgb,var(--mn-accent) 45%,transparent);outline-offset:-3px}
.mn-line{display:block;padding:0 16px;transition:background .2s}
.mn-numbered .mn-line{padding-left:0}
.mn-ln{display:inline-block;width:3.4em;padding-right:1.1em;text-align:right;color:var(--mn-muted);opacity:.65;user-select:none;-webkit-user-select:none}
.mn-lc{transition:opacity .2s}
.mn-t-c{color:#6b7280;font-style:italic}.mn-t-s{color:#0f7b4f}.mn-t-n,.mn-t-l{color:#b45309}.mn-t-k{color:#7c3aed}.mn-t-b{color:#0e7490}
.mn-t-f{color:#1d4ed8}.mn-t-d{color:#a16207}.mn-t-a{color:#be185d}.mn-t-v{color:#c2410c}
.mn-dark .mn-t-c{color:#8b93a1}.mn-dark .mn-t-s{color:#7ee2a8}.mn-dark .mn-t-n,.mn-dark .mn-t-l{color:#f6c177}.mn-dark .mn-t-k{color:#c4a7ff}
.mn-dark .mn-t-b{color:#67d4e8}.mn-dark .mn-t-f{color:#8fb0ff}.mn-dark .mn-t-d{color:#f7d96f}.mn-dark .mn-t-a{color:#f69bc8}.mn-dark .mn-t-v{color:#ffb38a}
.mn-codeblock figcaption,.mn-fig figcaption,.mn-vis figcaption{font-size:14px;line-height:1.55;color:var(--mn-muted)}
.mn-codeblock figcaption{padding:8px 14px;border-top:1px solid var(--mn-border);background:var(--mn-panel)}
/* figures and embedded visuals */
.mn-fig{margin:1.5em 0}
.mn-fig img{display:block;max-width:100%;height:auto;margin:0 auto;border-radius:10px;background:#fff;border:1px solid var(--mn-border)}
.mn-fig figcaption,.mn-vis figcaption{margin-top:8px}
.mn-credit{font-style:italic;opacity:.9}
.mn-fig-missing,.mn-vis-missing{padding:24px;border:1px dashed var(--mn-border);border-radius:10px;color:var(--mn-muted);font-size:14px;text-align:center}
.mn-vis{margin:1.5em 0}
.mn-vis-stage{position:relative;aspect-ratio:16/9;border-radius:12px;overflow:hidden;border:1px solid var(--mn-border);background:linear-gradient(#fff,#f5f5f7)}
.mn-vis-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.mn-vis-missing{position:absolute;inset:0;display:grid;place-items:center;border:0}
.mn-vis-bar{display:flex;align-items:center;gap:10px;margin-top:8px;font-size:13.5px;line-height:1.4}
.mn-vis-bar .mn-btn{padding:6px 12px;font-size:13.5px}
/* callouts */
.mn-callout{--c:var(--mn-accent);margin:1.3em 0;padding:12px 16px 12px 14px;border-radius:12px;border:1px solid color-mix(in srgb,var(--c) 30%,var(--mn-border));border-left:4px solid var(--c);background:color-mix(in srgb,var(--c) 6%,var(--mn-panel));font-size:16px;line-height:1.65}
.mn-callout-warning{--c:var(--mn-warn)}.mn-callout-misconception{--c:var(--mn-bad)}.mn-callout-open{--c:var(--mn-purple)}
.mn-callout-title{display:flex;align-items:center;gap:8px;font-weight:650;font-size:14.5px;color:var(--c);margin-bottom:3px}
.mn-callout-icon{width:19px;height:19px;border-radius:50%;background:var(--c);color:#fff;display:grid;place-items:center;font-size:11.5px;font-weight:800;flex:none;font-style:normal}
.mn-callout-body>:last-child{margin-bottom:0}
/* details on demand */
.mn-details{margin:1.1em 0;border:1px solid var(--mn-border);border-radius:12px;padding:0 16px;background:var(--mn-panel)}
.mn-details>summary{cursor:pointer;padding:11px 0;font-weight:600;list-style:none;display:flex;gap:8px;align-items:baseline}
.mn-details>summary::-webkit-details-marker{display:none}
.mn-details>summary::before{content:'▸';color:var(--mn-accent);transition:transform .2s;display:inline-block}
.mn-details[open]>summary::before{transform:rotate(90deg)}
.mn-details[open]>summary{border-bottom:1px solid var(--mn-border);margin-bottom:12px}
.mn-details-body{padding-bottom:4px}
/* tables scroll sideways on narrow screens */
.mn-table-wrap{overflow-x:auto;margin:1.3em 0;border:1px solid var(--mn-border);border-radius:12px}
.mn-table{border-collapse:collapse;width:100%;font-size:15px;line-height:1.55}
.mn-table th,.mn-table td{padding:9px 13px;text-align:left;vertical-align:top;border-bottom:1px solid var(--mn-border);min-width:7em}
.mn-table th{background:var(--mn-code-bg);font-weight:600;font-size:14px}
.mn-table tr:last-child td{border-bottom:0}
/* footnotes */
.mn-fnref a{color:var(--mn-accent)!important;text-decoration:none!important;font-size:.72em;font-weight:700;padding:0 2px}
.mn-fnref-missing{color:var(--mn-bad)}
.mn-sources{margin-top:2.6em;border-top:1px solid var(--mn-border);padding-top:1em;font-size:14px;line-height:1.55;color:var(--mn-muted)}
.mn-prose .mn-sources-title{font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 .6em;color:var(--mn-muted)}
.mn-sources ol{padding-left:1.5em;margin:0}.mn-sources li{margin:.35em 0;border-radius:6px;transition:background .4s}
.mn-flash{background:color-mix(in srgb,var(--mn-warn) 20%,transparent)}
/* derivations: one line at a time, each with its "why" */
.mn-dlines{list-style:none;padding:0;margin:1.2em auto;display:flex;flex-direction:column;gap:4px}
.mn-dline{display:grid;grid-template-columns:26px minmax(0,1fr);gap:12px;align-items:start;padding:8px 10px;border-radius:12px;transition:background .4s}
.mn-dline:last-child{background:color-mix(in srgb,var(--mn-accent) 5%,transparent)}
.mn-dline.mn-enter{animation:mn-rise .35s ease-out}
@keyframes mn-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.mn-dnum{width:26px;height:26px;border-radius:50%;background:var(--mn-faint);color:var(--mn-muted);display:grid;place-items:center;font-size:12px;font-weight:700;margin-top:7px}
.mn-dbody{min-width:0}
.mn-drow{display:flex;align-items:center;gap:10px;min-width:0;flex-wrap:wrap}
.mn-dtex{flex:1 1 220px;min-width:0;overflow-x:auto;overflow-y:hidden;padding:4px 0;font-size:18px}
.mn-dtex .mn-math{text-align:left!important}
.mn-why-btn{flex:none;border:1px solid color-mix(in srgb,var(--mn-accent) 40%,var(--mn-border));background:var(--mn-panel);color:var(--mn-accent);border-radius:999px;padding:3px 11px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;margin-left:auto}
.mn-why-btn:hover{border-color:var(--mn-accent)}
.mn-why-btn[aria-expanded=true]{background:var(--mn-accent);color:#fff;border-color:var(--mn-accent)}
.mn-why{margin:6px 0 4px;padding:10px 13px;border-left:3px solid var(--mn-accent);background:color-mix(in srgb,var(--mn-accent) 6%,var(--mn-panel));border-radius:0 10px 10px 0;font-size:15.5px;line-height:1.65}
.mn-dcontrols{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:12px;padding-left:48px}
.mn-dcontrols .mn-next-step{padding:10px 18px}
.mn-linkbtn{border:0;background:none;color:var(--mn-muted);text-decoration:underline;text-underline-offset:2px;font:inherit;font-size:14px;cursor:pointer;padding:4px}
.mn-linkbtn:hover{color:var(--mn-fg)}
.mn-blank{border:1.5px dashed var(--mn-accent);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;background:color-mix(in srgb,var(--mn-accent) 4%,var(--mn-panel));font-size:15.5px}
.mn-blank-prompt{font-weight:600;display:flex;gap:8px;align-items:center}
.mn-blank .mn-yt-icon{flex:none}
.mn-blank-right .mn-dnum{background:var(--mn-good);color:#fff}.mn-blank-shown .mn-dnum{background:var(--mn-warn);color:#fff}
.mn-dbody>.mn-feedback{margin-top:6px}
.mn-outro{margin-top:1.4em}
.mn-progress{height:6px;border-radius:3px;background:var(--mn-faint);overflow:hidden}
.mn-progress i{display:block;height:100%;width:0;background:var(--mn-accent);transition:width .4s}
.mn-derive-aside,.mn-code-aside,.mn-outline{display:flex;flex-direction:column;gap:8px}
.mn-outline ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.mn-outline-link{border:0;background:none;text-align:left;color:var(--mn-fg);font:inherit;font-size:14px;line-height:1.4;padding:5px 8px;border-radius:8px;cursor:pointer;width:100%}
.mn-outline-link:hover{background:var(--mn-faint)}
/* code walkthroughs: code beside its notes; the focused note lights up its lines */
.mn-codepage{padding-left:clamp(14px,3vw,36px);padding-right:clamp(14px,3vw,36px)}
.mn-cp{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:22px;align-items:start;margin-top:1.3em}
.mn-cp-code{position:sticky;top:calc(var(--mn-sticky-top,0px) + 12px);z-index:1;min-width:0}
.mn-cp-code .mn-codeblock{margin:0;box-shadow:var(--mn-shadow)}
.mn-cp-code .mn-code{max-height:calc(100vh - var(--mn-sticky-top,0px) - 110px)}
.mn-cp-help{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.mn-line.hl{background:color-mix(in srgb,var(--mn-accent) 11%,transparent);box-shadow:inset 3px 0 0 var(--mn-accent)}
.mn-focusing .mn-line:not(.hl) .mn-lc{opacity:.5}
.mn-shape-row{display:block;line-height:1.5;padding-bottom:2px;user-select:none;-webkit-user-select:none}
.mn-shape-tag{display:inline-block;padding:0 7px;border-radius:6px;font-size:11.5px;line-height:1.65;color:var(--mn-muted);background:var(--mn-panel);border:1px solid var(--mn-border);vertical-align:1px;white-space:nowrap;font-style:normal}
.mn-shape-tag.on{color:var(--mn-accent);border-color:var(--mn-accent);font-weight:600}
.mn-cp-notes{list-style:none;padding:0 0 28vh;margin:0;display:flex;flex-direction:column;gap:12px}
.mn-note{padding:12px 15px;border:1px solid var(--mn-border);border-radius:12px;background:var(--mn-panel);cursor:pointer;font-size:15.5px;line-height:1.65;transition:border-color .2s,box-shadow .2s}
.mn-note:hover{border-color:color-mix(in srgb,var(--mn-accent) 50%,var(--mn-border))}
.mn-note.active{border-color:var(--mn-accent);box-shadow:0 0 0 1px var(--mn-accent),var(--mn-shadow)}
.mn-note:focus-visible{outline:3px solid color-mix(in srgb,var(--mn-accent) 40%,transparent);outline-offset:2px}
.mn-note-lines{font-size:11.5px;font-weight:700;color:var(--mn-accent);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}
.mn-note-text>:last-child{margin-bottom:0}
.mn-note-shapes{margin-top:7px;font-size:13px;display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}
/* side by side only when the page itself is wide enough (it shares the window with the side panel) */
.mn-codepage{container-type:inline-size}
@container (max-width:860px){.mn-cp{grid-template-columns:minmax(0,1fr);gap:14px}.mn-cp-code{top:var(--mn-sticky-top,0px)}
 .mn-cp-code .mn-code{max-height:36vh}.mn-cp-notes{padding-bottom:30vh}.mn-cp-help{display:none}}
/* a case: several questions about one situation */
.mn-case-tag{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:700;color:var(--mn-accent);text-transform:uppercase;letter-spacing:.06em}
.mn-qnum{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:var(--mn-faint);color:var(--mn-fg);font-size:12px;font-weight:600;letter-spacing:0;text-transform:none}
/* free-text answers */
.mn-textarea{min-height:120px;resize:vertical;line-height:1.55;font-size:16px!important}
.mn-points{list-style:none;padding:0;margin:4px 0 0;display:flex;flex-direction:column;gap:6px;font-size:14.5px}
.mn-points li{display:flex;gap:8px;align-items:flex-start}
.mn-points .mk{flex:none;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;background:var(--mn-faint);color:var(--mn-muted)}
.mn-points .hit .mk{background:var(--mn-good);color:#fff}
.mn-points label{display:flex;gap:8px;align-items:flex-start;cursor:pointer}
.mn-points input{margin-top:4px;accent-color:var(--mn-accent)}
.mn-model{padding:10px 12px;border-radius:10px;background:var(--mn-faint);font-size:14.5px;line-height:1.6}
.mn-selfcheck{display:flex;flex-direction:column;gap:8px;border:1.5px solid var(--mn-accent);border-radius:12px;padding:12px 14px;background:color-mix(in srgb,var(--mn-accent) 5%,transparent)}
.mn-lang-note{font-size:12px;padding:2px 8px;border-radius:999px;background:var(--mn-faint);color:var(--mn-muted)}
.mn-game .mn-page{width:min(100%,880px);margin:0 auto}
@media (max-width:640px){.mn-page{font-size:16.5px;border-radius:12px}.mn-dline{grid-template-columns:22px minmax(0,1fr);gap:8px;padding:6px 4px}.mn-dnum{width:22px;height:22px;font-size:11px}
 .mn-dcontrols{padding-left:0}.mn-drow{flex-direction:column;align-items:stretch;gap:4px}.mn-drow .mn-dtex{flex:none}.mn-why-btn{align-self:flex-start;margin-left:0}.mn-code{font-size:12.5px}.mn-callout{font-size:15.5px}.mn-dtex{font-size:16px}}
/* ---- orientation and the overflow menu */
.mn-where{display:flex;align-items:center;gap:12px;font-size:13px;color:var(--mn-muted);margin-top:2px}
.mn-where>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.mn-where-bar{flex:1;min-width:60px;max-width:280px;height:4px;border-radius:2px;background:var(--mn-faint);overflow:hidden}
.mn-where-bar i{display:block;height:100%;background:var(--mn-accent);transition:width .4s}
/* step dots: done = filled, now = accent with a ring, upcoming = outline only */
.mn-app:not(.mn-game) .mn-dot{background:transparent;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--mn-muted) 45%,transparent);color:var(--mn-muted)}
.mn-app:not(.mn-game) .mn-dot.done{background:color-mix(in srgb,var(--mn-accent) 22%,var(--mn-panel));box-shadow:none;color:var(--mn-accent)}
.mn-app:not(.mn-game) .mn-dot.mn-explore:not(.now):not(.done),.mn-app:not(.mn-game) .mn-dot.mn-sketch:not(.now):not(.done){box-shadow:inset 0 0 0 1.5px var(--mn-accent);color:var(--mn-accent)}
.mn-app:not(.mn-game) .mn-dot.now{background:var(--mn-accent);color:#fff;box-shadow:0 0 0 3px color-mix(in srgb,var(--mn-accent) 25%,transparent)}
.mn-more{position:relative;flex:none}
.mn-more>summary{list-style:none;font-size:18px;line-height:1;letter-spacing:1px}
.mn-more>summary::-webkit-details-marker{display:none}
.mn-more-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:4;background:var(--mn-panel);border:1px solid var(--mn-border);border-radius:10px;box-shadow:var(--mn-shadow);padding:6px;white-space:nowrap}
.mn-more-menu .mn-btn{border:0;width:100%;text-align:left}
.mn-resumed{font-size:13px;color:var(--mn-muted)}
.mn-resumed .mn-linkbtn{font-size:13px}
/* "explain this": a quiet button under the step's actions; on phones it floats in the corner */
.mn-helpbtn{align-self:flex-start;display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:13.5px;color:var(--mn-muted);background:transparent;border:1px dashed var(--mn-border);border-radius:999px;padding:5px 12px 5px 6px;cursor:pointer}
.mn-helpbtn:hover,.mn-helpbtn:focus-visible{color:var(--mn-accent);border-color:var(--mn-accent);border-style:solid;outline:none}
.mn-helpicon{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:color-mix(in srgb,var(--mn-accent) 12%,transparent);color:var(--mn-accent);font-weight:700;font-size:12px}
@media (max-width:900px){.mn-helpbtn{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:20;background:var(--mn-panel);border-style:solid;box-shadow:0 4px 18px rgba(0,0,0,.14);padding:8px 14px 8px 8px;color:var(--mn-fg)}}
.mn-askhere{position:fixed;z-index:40;font:600 13px/1 Inter,ui-sans-serif,system-ui,"PingFang SC",sans-serif;padding:8px 12px;border-radius:999px;border:0;background:#15171a;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.22);cursor:pointer;white-space:nowrap}
.mn-askhere[hidden]{display:none}
.mn-endextra:empty{display:none}
.mn-labcard{display:flex;flex-direction:column;gap:3px;padding:12px 14px;border:1px solid var(--mn-border);border-left:3px solid var(--mn-purple);border-radius:12px;text-decoration:none;color:inherit;background:var(--mn-bg)}
.mn-labcard:hover{border-color:var(--mn-purple)}
.mn-labcard-kicker{font-size:12px;color:var(--mn-purple);font-weight:600}
.mn-labcard-title{font-weight:600;font-size:15px}
.mn-labcard-note{font-size:13px;color:var(--mn-muted)}
@media (prefers-reduced-motion:reduce){.mn-app *{transition:none!important;animation:none!important}}
`;
let injected = false;
export function inject_styles(doc: Document = document): void {
  if (injected) return;
  injected = true;
  const s = doc.createElement('style');
  s.textContent = CSS;
  doc.head.appendChild(s);
}
