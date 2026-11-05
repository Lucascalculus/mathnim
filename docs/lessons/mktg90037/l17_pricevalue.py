# Lesson 17 of MKTG90037: pricing, the value side (Week 10, second half): new-product, value-based and personalised pricing, price
# psychology, competition and ethics. Brand: Hilton (Honors member discount, points-and-money, free Wi-Fi: 10-K). The airline
# conjoint profiles of round one and the Blackmores, Trivago and SPSS cases are the lecture's; the other profiles are made up.
# Instruments: conjoint game (Choose), the decoy experiment (Choose), which price effect (Tag).
from mk import *  # noqa: F403


def L17(CID):
    SK = 'mk.pricing-value'

    def o(id, fr, seat, meal, chk, price, label):
        return dict(id=id, label=T(label[0], label[1]), detail=T(f"{fr[0]}, {seat[0]}, {meal[0]}, {chk[0]}, {price}", f"{fr[1]}，{seat[1]}，{meal[1]}，{chk[1]}，{price}"),
                    attrs=dict(freq=fr[2], seat=seat[2], meal=meal[2], check=chk[2], price=str(price)))
    HR, TH = ('flies every hour', '每小时一班', 'hour'), ('three flights a day', '每天三班', 'three')
    SM, NO, BR = ('small seats', '座位窄', 'small'), ('normal seats', '座位普通', 'normal'), ('broad seats', '座位宽', 'broad')
    SN, FM = ('snacks', '小食', 'snack'), ('a full meal', '正餐', 'meal')
    FA, SL = ('fast check-in', '快速值机', 'fast'), ('slow check-in', '慢速值机', 'slow')
    rounds = [
        dict(prompt=T('You are in London with a 2 pm meeting in Barcelona. Which flight?', '你在伦敦，下午两点要在巴塞罗那开会。选哪班？'),
             options=[o('a1', HR, NO, SN, FA, 390, ('Golden Wings', 'Golden Wings')), o('a2', HR, BR, FM, FA, 490, ('Sky Line', 'Sky Line')), o('a3', TH, SM, SN, SL, 350, ('Air Shuttle', 'Air Shuttle'))]),
        dict(prompt=T('Next trip, a different pair.', '下一次出行，换一对选择。'), options=[o('b1', HR, SM, SN, FA, 350, ('Flight A', '航班 A')), o('b2', TH, BR, FM, FA, 390, ('Flight B', '航班 B'))]),
        dict(prompt=T('And again.', '再来一次。'), options=[o('c1', HR, NO, FM, SL, 490, ('Flight C', '航班 C')), o('c2', TH, NO, SN, FA, 350, ('Flight D', '航班 D'))]),
        dict(prompt=T('Last pair.', '最后一对。'), options=[o('d1', HR, BR, SN, SL, 390, ('Flight E', '航班 E')), o('d2', TH, SM, FM, FA, 490, ('Flight F', '航班 F'))]),
    ]
    attrs = [dict(id='freq', label=T('Frequency', '班次'), levels=[dict(id='hour', label=T('every hour', '每小时')), dict(id='three', label=T('three a day', '每天三班'))]),
             dict(id='seat', label=T('Seat', '座位'), levels=[dict(id='small', label=T('small', '窄')), dict(id='normal', label=T('normal', '普通')), dict(id='broad', label=T('broad', '宽'))]),
             dict(id='meal', label=T('Food', '餐食'), levels=[dict(id='snack', label=T('snacks', '小食')), dict(id='meal', label=T('full meal', '正餐'))]),
             dict(id='check', label=T('Check-in', '值机'), levels=[dict(id='fast', label=T('fast', '快')), dict(id='slow', label=T('slow', '慢'))]),
             dict(id='price', label=T('Price', '价格'), levels=[dict(id='350', label=T('350', '350')), dict(id='390', label=T('390', '390')), dict(id='490', label=T('490', '490'))])]
    dec_rounds = [
        dict(prompt=T('A magazine subscription (a made-up offer). Which do you take?', '一份杂志订阅（编出来的方案）。你选哪个？'),
             options=[dict(id='basic', label=T('Web only', '仅网页版'), detail=T('AUD 60 a year', '每年 60 澳元')), dict(id='premium', label=T('Web and print', '网页加纸质版'), detail=T('AUD 125 a year', '每年 125 澳元'))]),
        dict(prompt=T('The same magazine, with a third offer added. Which now?', '同一份杂志，多了第三个方案。现在选哪个？'),
             options=[dict(id='basic', label=T('Web only', '仅网页版'), detail=T('AUD 60 a year', '每年 60 澳元')), dict(id='decoy', label=T('Print only', '仅纸质版'), detail=T('AUD 125 a year', '每年 125 澳元')), dict(id='premium', label=T('Web and print', '网页加纸质版'), detail=T('AUD 125 a year', '每年 125 澳元'))]),
    ]
    cats = [dict(id='iso', label=T('Isolation effect', '孤立效应')), dict(id='com', label=T('Compromise effect', '折中效应')), dict(id='att', label=T('Attraction effect', '吸引效应')), dict(id='int', label=T('Internal reference price', '内部参考价')), dict(id='ext', label=T('External reference price', '外部参考价'))]
    items = [
        dict(text=T('A jacket looks much more attractive when it is placed next to a far dearer one than when it is seen alone.', '一件夹克放在贵得多的那件旁边，比单独看时显得有吸引力得多。'), cat='iso', why=T('An option looks better against a costly alternative than in isolation.', '一个选项在昂贵的替代品映衬下，比单独看更有吸引力。')),
        dict(text=T('In a small, medium and large menu, most buyers pick the medium.', '在小、中、大三档的菜单里，多数买家选中档。'), cat='com', why=T('Buyers choose the middle option over the extremes.', '买家会选中间的选项，而不是两头。')),
        dict(text=T('Adding a clearly worse third offer makes one of the first two look better.', '加上一个明显更差的第三方案，会让原来两个里的一个显得更好。'), cat='att', why=T('A decoy that is asymmetrically dominated shifts preference between the other two.', '一个被单侧完全压制的诱饵，会改变对另外两者的偏好。')),
        dict(text=T('A shelf label says: “Was 150, now 90.”', '货架标签写着：“原价 150，现价 90。”'), cat='int', why=T('A price framed against a previous price held in the buyer’s mind.', '用买家心里已有的此前价格来框定当前价格。')),
        dict(text=T('A retailer promises to match or beat any competitor’s price.', '零售商承诺跟平或击败任何竞争对手的价格。'), cat='ext', why=T('A price framed against a current competitor price: a price-matching guarantee.', '用当前竞争对手的价格来框定价格：价格匹配保证。')),
    ]
    return dict(
        id=f'{CID}-pricing-value',
        title=T('How do I charge for what it is worth?', '怎样按价值收费？'),
        description=T('Value-based pricing, conjoint trade-offs, personalised pricing and when it works, price psychology and ethics, with Hilton Honors.', '价值导向定价、联合分析的取舍、个性化定价及其适用条件、价格心理与伦理，案例是 Hilton Honors。'),
        minutes=50,
        skills=[{'id': SK, 'name': T('Explaining and applying value-based pricing and pricing psychology', '解释并应用价值导向定价和价格心理')}],
        misconceptions=[
            {'id': 'value-pricing-is-high-price', 'description': T('value-based pricing just means charging a high price', '价值导向定价就是收高价')},
            {'id': 'decoy-irrelevant', 'description': T('adding an option nobody picks cannot change what people choose', '加一个没人选的选项，不会改变人们的选择')},
        ],
        steps=[
            read('puzzle', T('One cup of coffee, five prices in one kilometre', '一杯咖啡，一公里内五个价'),
                 p(T("Within a kilometre of one suburban address, a latte cost 5.90, 7.30, 6.50, 5.50 or 3.00 dollars. Nothing in the cost of milk and beans explains a spread like that. Something else must: what each buyer thinks the cup is worth, where they are, and what it is next to.",
                     "在郊区一个地址一公里之内，一杯拿铁的价格是 5.90、7.30、6.50、5.50 或 3.00 澳元。牛奶和咖啡豆的成本解释不了这样的差距。一定还有别的：每位买家认为这杯咖啡值多少、他们在哪里、旁边放着什么。")),
                 p(T("Last lesson set the **floor** with cost. This one asks how far above it you can go, and how to do it fairly.", "上一课用成本设了**底线**。这一课问底线之上能走多远，以及怎样公平地做。")), chapter=CH['puzzle']),
            predict('guess', SK, T("A magazine offers web only at 60 and web plus print at 125. Then it adds print only at 125. Nobody is meant to buy it. What happens to the choices?", "一本杂志提供仅网页版 60、网页加纸质版 125。然后它又加了一个仅纸质版 125，本来就没打算让人买。人们的选择会怎样？"),
                    [(T("More people pick web plus print, because print only makes it look like the better deal", "更多人选网页加纸质版，因为仅纸质版让它显得更划算"), True),
                     (T("Nothing: nobody picks the new option", "没变化：没人选新方案"), T("Options that are not picked can still change what is picked.", "没人选的选项，仍可能改变人们选什么。")),
                     (T("More people pick web only", "更多人选仅网页版"), T("The decoy is dominated by the premium option, not by the cheap one.", "诱饵是被高价选项压制的，不是被低价选项。")),
                     (T("Fewer people buy anything", "买的人更少"), T("The decoy tends to move people towards the better option, not away.", "诱饵倾向于把人推向更好的选项，而不是推开。"))],
                    T("That is the **attraction (decoy) effect**: a third option dominated by one of the others shifts preference. Try it yourself, then play the conjoint game.", "这就是**吸引（诱饵）效应**：被其中一个选项压制的第三个选项，会改变偏好。先亲身试试，再玩联合分析游戏。")),
            read('touch', T('Does a decoy move you?', '诱饵会动摇你吗？'),
                 p(T("A made-up subscription, shown twice: first with two offers, then with three.", "一个编出来的订阅，看两次：第一次两个方案，第二次三个方案。")),
                 choose(T('Two rounds of choosing a magazine subscription, without and with a decoy.', '两轮选杂志订阅，没有和有诱饵。'), dec_rounds, dict(type='switch', a=0, b=1, target='premium',
                        same=T('You chose the same both times: this decoy did not move you.', '你两次选了同一个：这个诱饵没有动摇你。'), moved=T('You moved to web and print once print only was on the page.', '页面上出现仅纸质版之后，你换成了网页加纸质版。'), other=T('Your choice changed, but not towards the target.', '你的选择变了，但不是朝目标方向。'),
                        text=T("The decoy was **asymmetrically dominated**: print only costs the same as web and print and gives less, so web and print looks like a bargain. It works on many people, not all; the point is that **the choice set changes the choice**, so a pricing manager designs the set as well as the price.", "诱饵是**被单侧压制**的：仅纸质版价格与网页加纸质版相同，给得更少，所以网页加纸质版显得是笔划算的买卖。它对很多人有效，不是所有人；重点是**选择集会改变选择**，所以定价经理不只设计价格，也设计选择集。")), height=480),
                 chapter=CH['touch']),
            read('touch2', T('What do you really value? Trade-offs', '你真正看重什么？取舍'),
                 p(T("When people are forced into hard trade-offs, we learn what they truly value. Four flight choices; the first is the lecture’s example, the others are made up.", "当人们被迫做艰难取舍时，我们才知道他们真正看重什么。四次航班选择；第一次是课程里的例子，其余是编的。")),
                 choose(T('Four choices between flights that differ in frequency, seat, food, check-in and price; afterwards, how often each feature level was in your chosen flight.', '四次航班选择，航班在班次、座位、餐食、值机和价格上不同；之后显示每个特征水平出现在你所选航班里的频率。'), rounds, dict(type='tally', attrs=attrs,
                        text=T("This is **conjoint analysis** in miniature: from a handful of forced trade-offs you can estimate how much each feature is worth, and so **how much more a customer would pay** for it. With many respondents, each feature’s importance can be turned into a price.", "这是缩微版的**联合分析**：从少数几次被迫的取舍里，可以估出每个特征值多少，从而知道顾客**愿意多付多少钱**。有了许多受访者，每个特征的重要性都能换算成价格。")), height=700)),
            read('touch3', T('Three look-alike effects', '三个长得像的效应'),
                 p(T("Price psychology has several effects with similar names. Five examples, five labels.", "价格心理学有几个名字相近的效应。五个例子，五个标签。")),
                 tag(T('Five examples to tag as isolation, compromise, attraction, internal reference or external reference.', '五个例子，标为孤立、折中、吸引、内部参考价或外部参考价。'), cats, items,
                     done=T("**Isolation**: looks better beside a costly alternative. **Compromise**: pick the middle. **Attraction**: a dominated decoy shifts the choice. **Reference price**: framed against a prior (internal) or current competitor (external) price.", "**孤立**：在昂贵的替代品旁显得更好。**折中**：选中间。**吸引**：被压制的诱饵改变选择。**参考价**：用此前价格（内部）或当前竞争对手价格（外部）来框定。"), height=780)),
            read('name', T('The framework, as the marker wants it', '阅卷人要的框架'),
                 p(T("**Value-based pricing** sets the price from the customer’s perceived value and competitors’ offers, between the cost floor and the ceiling where there is no demand, aiming to **create willingness to pay**. **Conjoint analysis** finds value by forcing trade-offs between bundles of attributes. Value has to be communicated (catalogues for facts, the sales force for emotion, a test drive for experience), and **value-based selling** asks how to find needs, present benefits and decide when to talk about price. **Value-in-use pricing** sets the price from the customer’s lower total lifetime cost versus a competitor (acquisition, usage and maintenance savings); it works best in the growth stage, when prices need to be high enough to support profit and the better value can be shown.",
                     "**价值导向定价**根据顾客感知价值和竞争对手的方案定价，处于成本底线和“没有需求”的天花板之间，目标是**创造支付意愿**。**联合分析**通过迫使人们在属性组合之间取舍来发现价值。价值必须被传达（目录传达事实、销售队伍传达情感、试驾传达体验），**价值销售**问的是怎样发现需求、介绍利益、何时谈价格。**使用价值定价**依据顾客相对竞争对手更低的总生命周期成本来定价（购置、使用和维护的节省）；它在成长期最有效，那时价格需要足够高才能支撑利润，而且更好的价值能被证明。")),
                 details(T('New-product pricing, product lines and innovation in pricing', '新产品定价、产品线与定价创新'),
                         ul(T("Pricing is critical and hard to reverse; there is little information. Three informants: **cost**, **competition**, **value**.", "定价关键，又难以反转；信息很少。三种依据：**成本**、**竞争**、**价值**。"),
                            T("**Skimming**: a high premium price with superior value, reduced over time. **Penetration**: a low initial price to speed adoption and share; related to learning-curve pricing.", "**撇脂**：高溢价配合出众的价值，随时间下调。**渗透**：低的初始价格以加速采用和份额；与学习曲线定价相关。"),
                            T("**Product line pricing**: visible reasons for price differences; may confuse customers or cannibalise higher-priced products; complementary or captive products, bundling, customer-value pricing (Noble and Gruca’s situations: new product, competitive, product line, cost-based).", "**产品线定价**：价格差异要有看得见的理由；可能让顾客困惑或蚕食高价产品；配套或捆绑产品、打包、顾客价值定价（Noble 和 Gruca 的情境：新产品、竞争、产品线、成本导向）。"),
                            T("**Innovation in pricing** (Hinterhuber and Liozu) needs no product innovation: strategy (needs-based segmentation, pay-for-performance, zero as a special price), tactics (bundling, flat fees, contingent pricing) and organisation (a pricing function, champions, experiments). **Pricing capability** is the ability to set the right price at the right time.", "**定价创新**（Hinterhuber 和 Liozu）不需要产品创新：战略（基于需求的细分、按绩效付费、零作为特殊价格）、战术（打包、固定费、附条件定价）、组织（定价职能、倡导者、实验）。**定价能力**是在正确的时间定出正确价格的能力。"))),
                 details(T('Personalised, variable, odd and group pricing', '个性化、可变、尾数与群体定价'),
                         ul(T("**Personalised pricing**: different prices to different customers by willingness to pay, moving consumer surplus to the firm; customers self-select (first, business, economy) or are selected. It works when: the market can be segmented by intensity of demand; **arbitrage** is blocked (low-price buyers cannot resell to high-price buyers); competitors cannot undersell in the high-price segment; it does not breed resentment; it is legal; and customers see different value. Airlines charge more as the flight date nears.", "**个性化定价**：按支付意愿对不同顾客收不同价格，把消费者剩余转给企业；顾客自选（头等、商务、经济）或被选择。适用条件：市场可按需求强度细分；**套利**被堵住（低价买家不能转售给高价买家）；竞争对手不能在高价细分里压价；不引起反感；合法；顾客看到不同的价值。航空公司在临近飞行日时收更高价。"),
                            T("**Arbitrage and grey markets**: a US edition of a textbook at 70 and an Indian edition at 25; Blackmores lost 24% of its share market value in one day in February 2019 as products reached Chinese buyers through discounted channels. Natural barriers such as language and warranties help.", "**套利与灰色市场**：一本教科书美国版 70、印度版 25；2019 年 2 月 Blackmores 因产品通过折扣渠道流向中国买家，一天内市值下跌 24%。语言、保修等天然屏障有帮助。"),
                            T("**Variable pricing** follows predictable rules (time, season, customer category): Coca-Cola’s 1999 test of vending machines that raised prices in hot weather caused resentment; consistency across channels is a retailer’s problem.", "**可变定价**遵循可预测的规则（时间、季节、顾客类别）：可口可乐 1999 年测试在炎热天气涨价的自动售货机引起反感；跨渠道价格一致是零售商的难题。"),
                            T("**Odd pricing** (99 endings): buyers read the “big number”, and 99 can signal a discount; common in fast-moving consumer goods. **Group pricing**: business and student software licences (SPSS) priced very differently; “catch them young” for lock-in and later higher-priced sales.", "**尾数定价**（99 结尾）：买家看的是“大数字”，99 还能传递折扣信号；常见于快消品。**群体定价**：企业版与学生版软件许可（SPSS）定价悬殊；“趁年轻抓住他们”，以锁定并日后卖更高价的东西。"))),
                 details(T('Competition and ethics', '竞争与伦理'),
                         ul(T("**Leader pricing** (rivals match a dominant firm), **going-rate pricing** (the market price, in transparent or undifferentiated markets such as steel or petrol), **auction pricing**. Competitors react when the firm is a major player, the market is growing, offers are undifferentiated, the product nears commodity status, or fixed costs press on volume.", "**领导者定价**（对手跟随主导企业）、**现行价格定价**（按市场价，在透明或无差异的市场，如钢铁、汽油）、**拍卖定价**。竞争对手在这些情形下会反应：企业是主要玩家、市场在增长、产品无差异、接近大宗商品、固定成本给销量施压。"),
                            T("**Predatory pricing**: selling at direct cost to push rivals out; illegal in most countries. Misleading price advertising is punished: a travel-search site was fined 44.7 million dollars. A **captive product** (you must buy the related consumable) is product-line pricing that raises fairness issues. The **price-quality matrix** gives names to nine positions, from rip-off and overcharging to premium, to economy and superb value.", "**掠夺性定价**：按直接成本出售以挤走对手；多数国家违法。误导性的价格广告会受罚：一家旅游搜索网站被罚 4,470 万澳元。**捆绑耗材**（必须买相关耗材）是产品线定价，会引发公平问题。**价格–质量矩阵**给九个位置命名，从敲竹杠、过高定价到溢价，到经济型和超值。"))),
                 chapter=CH['name']),
            apply_q('apply', SK, T("Hilton’s Honors members who book through Hilton’s own channels get a points-and-money option, an exclusive member discount and free standard Wi-Fi. Treat the member discount as **personalised or group pricing**. Write four sentences testing it on **three of the six conditions** (segmentable; arbitrage; competitors; resentment; legal; different value) with a reason each.", "通过 Hilton 自有渠道预订的 Honors 会员，可以使用积分加现金、享会员专属折扣和免费标准 Wi-Fi。把会员折扣当作**个性化或群体定价**。写四句话，用六个条件（可细分、套利、竞争对手、反感、合法、价值不同）中的**三个**检验它，每个给出理由。"),
                    [T("Treats membership as a segment that can be identified (members versus non-members, a segmentable market)", "把会员身份当作可识别的细分（会员对非会员，可细分的市场）"), T("Says arbitrage is hard because the discount is tied to the member’s account and stay", "说明套利很难，因为折扣绑定会员账户和入住"),
                     T("Notes resentment risk if non-members see a cheaper member price, offset because membership is open to join", "指出非会员看到会员价更便宜可能反感，但会员资格开放加入，可缓解"), T("Uses only true Honors benefits", "只用真实的 Honors 福利")],
                    T("Segmentable: membership identifies guests with different loyalty and value, 243 million at the end of 2025, so the discount reaches the right segment. Arbitrage: it is hard to resell a room stay booked on a member account, so low-price buyers cannot pass the discount to others, which keeps the price difference. Resentment: guests who pay the non-member price might resent it, but joining is open, and the discount rewards booking direct, so the cause of the difference is visible. These readings of the conditions are my own; the benefits themselves are from Hilton’s annual report.",
                      "可细分：会员身份识别出忠诚度和价值不同的客人，2025 年底有 2.43 亿，所以折扣到了正确的细分。套利：绑定在会员账户上的住宿很难转售，低价买家无法把折扣转给别人，所以价差得以保持。反感：付非会员价的客人可能不满，但加入是开放的，而且折扣奖励的是直接预订，所以差价的原因看得见。这些对条件的判断是我自己的解读；福利本身来自 Hilton 的年报。"),
                    T("Test three conditions with a reason each, say which readings are yours.", "检验三个条件并各给理由，说明哪些判断是你自己的。")),
            choice('neighbour', T('The look-alike', '长得像的那个'), SK,
                   T("A store labels a coat “Was 300, now 180” to make 180 look cheap. Which effect is that?", "一家店给一件外套标“原价 300，现价 180”，让 180 显得便宜。这是哪种效应？"),
                   [(T("Internal reference pricing: framing the price against a prior price", "内部参考价：用此前的价格来框定价格"), True), (T("Attraction effect", "吸引效应"), T("That needs a third, dominated option.", "那需要第三个被压制的选项。")),
                    (T("Compromise effect", "折中效应"), T("That is picking the middle.", "那是选中间。"))],
                   T("Prior price: internal reference.", "此前价格：内部参考价。"), purpose='check', chapter=CH['neighbour']),
            recall('r1', SK, T("From lesson 16: for an inelastic good, a price rise…", "来自第 16 课：对无弹性的商品，涨价……"),
                   [(T("raises revenue, since volume falls less than price rises", "增加收入，因为销量降得比价格涨得少"), True), (T("lowers revenue", "减少收入"), T("That is the elastic case.", "那是有弹性的情形。"))], T("Elasticity decides.", "由弹性决定。"), first=True),
            recall('r2', SK, T("From lesson 1: a customer’s willingness to pay comes from…", "来自第 1 课：顾客的支付意愿来自……"),
                   [(T("perceived value, compared with alternatives", "感知价值，与替代品比较"), True), (T("the firm’s cost", "企业的成本"), T("Cost is the firm’s side, not the customer’s.", "成本是企业一侧的，不是顾客一侧的。"))], T("Value is perceived and relative.", "价值是感知的、相对的。")),
        ] + exam_three('exam', SK,
                       T("Question. (a) Explain value-based pricing and how it differs from cost-based pricing. (b) Apply the ideas to Hilton Hotels in Australia. (c) Make two pricing recommendations.", "题目。(a) 解释价值导向定价，以及它与成本导向定价有何不同。(b) 把这些概念应用到澳大利亚的 Hilton 酒店。(c) 给出两条定价建议。"),
                       (T("Write the **Explain** part.", "写**解释**部分。"),
                        [T("Value-based pricing: from perceived customer value and competitor offers; creates willingness to pay; sits above the cost floor", "价值导向定价：依据顾客感知价值和竞争对手的方案；创造支付意愿；在成本底线之上"), T("Contrast with cost-based: starts from cost with a markup", "与成本导向对比：从成本加成出发"),
                         T("Methods: conjoint analysis, value-in-use, value communication", "方法：联合分析、使用价值定价、价值传达"), T("Related ideas such as personalised pricing and reference effects, precisely", "相关概念如个性化定价和参考价效应，表述精确")],
                        T("Value-based pricing sets price from the value customers perceive and the alternatives they have, aiming to create willingness to pay, between the floor set by cost and the ceiling where demand ends. Cost-based pricing starts from cost and adds a markup, so it ignores demand and competitors. Value can be found with conjoint analysis, which forces trade-offs between attribute bundles, and with value-in-use pricing, based on the customer’s lower lifetime cost. It must also be communicated, by catalogues, sales force or experience. Related tactics include personalised pricing, which needs segments, blocked arbitrage and no resentment, and reference effects such as isolation, compromise and attraction.",
                          "价值导向定价根据顾客感知的价值和他们拥有的替代品定价，目标是创造支付意愿，处于成本设定的底线和需求终止的天花板之间。成本导向定价从成本出发加成，所以忽略需求和竞争对手。价值可以用联合分析来发现，它迫使人们在属性组合之间取舍，也可以用基于顾客更低生命周期成本的使用价值定价。价值还必须被传达，通过目录、销售队伍或体验。相关策略包括个性化定价（需要细分、堵住套利、不引起反感）以及孤立、折中、吸引等参考价效应。")),
                       (T("Write the **Apply** part.", "写**应用**部分。"),
                        [T("Uses true Hilton facts: Honors 243 million members; points-and-money option; member discount; free standard Wi-Fi when booking through Hilton channels", "用真实的 Hilton 事实：Honors 2.43 亿会员；积分加现金选项；会员折扣；通过 Hilton 渠道预订享免费标准 Wi-Fi"), T("Applies value-based and personalised pricing with cause and effect", "运用价值导向和个性化定价并说明因果"),
                         T("Considers conditions (segmentation, arbitrage, resentment) and the guests’ different value", "考虑条件（细分、套利、反感）和客人不同的价值"), T("Notes that the facts are global and what is reading", "说明事实是全球的，以及哪些是解读")],
                        T("These facts are Hilton’s global figures. Hilton does not price on cost alone: its Honors programme, with 243 million members at the end of 2025, gives members a points-and-money option, an exclusive member discount and free standard Wi-Fi when they book through Hilton’s channels. That is personalised pricing by membership: guests who value loyalty and booking certainty pay less, and the discount rewards booking direct, which supports Hilton’s own channels. It works because members are identifiable, arbitrage is hard, since the stay is tied to the account, and the difference has a visible reason, so resentment is limited, which is my reading. Value-based pricing shows in the benefits that are not price at all: free Wi-Fi and points raise perceived value without cutting the room rate, which protects the franchisees’ revenue.",
                          "这些事实是 Hilton 的全球数据。Hilton 不只按成本定价：它的 Honors 计划在 2025 年底有 2.43 亿会员，会员通过 Hilton 渠道预订时可用积分加现金、享会员专属折扣和免费标准 Wi-Fi。这是按会员身份做的个性化定价：看重忠诚和预订确定性的客人付得更少，而折扣奖励直接预订，支持了 Hilton 自己的渠道。它之所以行得通，是因为会员可识别，套利难（住宿绑定账户），差价的原因看得见，所以反感有限，这是我的解读。价值导向定价体现在根本不是价格的福利上：免费 Wi-Fi 和积分在不降低房价的情况下提升了感知价值，这保护了加盟商的收入。")),
                       (T("Write the **Recommend** part: exactly two pricing recommendations.", "写**建议**部分：恰好两条定价建议。"),
                        [T("Exactly two from the analysis (add benefits instead of rate cuts; use a decoy or tiering for room types)", "恰好两条，从分析里推出（用加福利代替降房价；对房型使用诱饵或分层）"), T("Each actionable", "每条可执行"), T("A risk named", "点出风险")],
                        T("First, answer weak demand with added member benefits, such as late checkout or room choice, rather than a lower room rate, because benefits raise perceived value without lowering the price franchisees earn. The risk is cost per stay, so offer benefits that cost little to deliver. Second, show three room types in booking channels, with the middle one priced so it looks the best value, because the compromise and attraction effects steer choices towards it. The risk is that guests feel steered, so make sure the middle option really is good value.",
                          "第一，用增加会员福利来应对需求疲软，如延迟退房或可选房型，而不是降低房价，因为福利提高感知价值，而不压低加盟商赚到的价格。风险是每次入住的成本，所以选提供成本低的福利。第二，在预订渠道里展示三种房型，把中间那种定价得显得最划算，因为折中效应和吸引效应会把选择引向它。风险是客人觉得被引导，所以中间选项必须真的划算。")),
                       ),
    )
