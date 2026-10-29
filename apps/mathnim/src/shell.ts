// App chrome: navigation bar (with the language switch) + hash router.
import { LANGS, type Lang } from '@mathnim/core';
import { esc, hush_all, inject_styles, on_ui_lang, t, ui_lang } from '@mathnim/present';
import './i18n';
import { lesson_path } from './course';
import { intercept_links, legacy_path, navigate, parse, set_router, type Route } from './router';
import { load_settings } from './settings';
import { settings_panel } from './pages/settings';
import { accounts_available, current_user, sign_out, studio_available } from './account';
import { login_form } from './login';
import { SHEET } from './sheet';

const CSS = `
body{margin:0;background:#fbfbfa}
.app-shell{--mn-sticky-top:58px;--mn-bg:#fbfbfa;--mn-fg:#15171a;--mn-muted:#6b7077;--mn-faint:#ececE8;--mn-panel:#fff;--mn-border:#e3e3de;--mn-accent:#2f5bd3;--mn-good:#1f8a5b;--mn-bad:#c2412d;--mn-warn:#b7791f;--mn-radius:14px;--mn-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 28px rgba(0,0,0,.06);
 font:15px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--mn-fg);background:var(--mn-bg);min-height:100vh}
.app-shell.dark{--mn-bg:#0d0f12;--mn-fg:#eef1f6;--mn-muted:#8d96a6;--mn-faint:#232830;--mn-panel:#14171c;--mn-border:#262b33;--mn-accent:#8fb0ff;--mn-shadow:none}
.nav{display:flex;align-items:center;gap:22px;padding:14px 24px;border-bottom:1px solid var(--mn-border);position:sticky;top:0;background:color-mix(in srgb,var(--mn-bg) 88%,transparent);backdrop-filter:blur(8px);z-index:5}
.nav .brand{font-weight:700;letter-spacing:-.02em;font-size:18px;display:flex;gap:8px;align-items:center;color:inherit;text-decoration:none}
.nav a{color:var(--mn-muted);text-decoration:none;font-size:14px;white-space:nowrap}
.nav a.on{color:var(--mn-fg);font-weight:600}
.nav .count{display:inline-block;min-width:18px;padding:0 5px;border-radius:9px;background:var(--mn-accent);color:#fff;font-size:11px;text-align:center;margin-left:4px}
.nav .langs{margin-left:auto}
.nav{position:sticky}
.set-pop{position:absolute;top:calc(100% + 8px);right:16px;width:min(360px,calc(100vw - 24px));padding:4px 20px;z-index:30;box-shadow:0 18px 50px -12px rgba(0,0,0,.22)}
.set-pop[hidden]{display:none}
@media (max-width:640px){.set-pop{left:10px;right:10px;width:auto}}
/* the top bar's tools, bare at rest: the account (signed out a blank sheet, a 3x3 dot grid; signed in, the initial
   in the tutor's serif), and the settings gear. Pointed at (or open), four crop marks close in on either; the gear also turns.
   The account's card drops from it as a lab pass on the engineering sheet (sheet.ts); signing in stamps it. */
.nav-tools{margin-left:auto;display:flex;align-items:center;gap:8px}
.nav-ic{flex:none;position:relative;display:grid;place-items:center;width:32px;height:32px;padding:0;border:0;background:none;color:var(--mn-muted);cursor:pointer;transition:color .15s}
.nav-ic:hover,.nav-ic[aria-expanded=true]{color:var(--mn-fg)}
.nav-ic>i{position:absolute;width:5px;height:5px;border:0 solid currentColor;opacity:0;transition:inset .3s cubic-bezier(.3,1.5,.5,1),opacity .2s}
.nav-ic>i:nth-child(1){left:-4px;top:-4px;border-left-width:1.3px;border-top-width:1.3px}
.nav-ic>i:nth-child(2){right:-4px;top:-4px;border-right-width:1.3px;border-top-width:1.3px}
.nav-ic>i:nth-child(3){left:-4px;bottom:-4px;border-left-width:1.3px;border-bottom-width:1.3px}
.nav-ic>i:nth-child(4){right:-4px;bottom:-4px;border-right-width:1.3px;border-bottom-width:1.3px}
.nav-ic:hover>i,.nav-ic[aria-expanded=true]>i,.nav-ic:focus-visible>i{opacity:1}
.nav-ic:hover>i:nth-child(1),.nav-ic[aria-expanded=true]>i:nth-child(1),.nav-ic:focus-visible>i:nth-child(1){left:2px;top:2px}
.nav-ic:hover>i:nth-child(2),.nav-ic[aria-expanded=true]>i:nth-child(2),.nav-ic:focus-visible>i:nth-child(2){right:2px;top:2px}
.nav-ic:hover>i:nth-child(3),.nav-ic[aria-expanded=true]>i:nth-child(3),.nav-ic:focus-visible>i:nth-child(3){left:2px;bottom:2px}
.nav-ic:hover>i:nth-child(4),.nav-ic[aria-expanded=true]>i:nth-child(4),.nav-ic:focus-visible>i:nth-child(4){right:2px;bottom:2px}
.nav-ic svg{display:block;transition:transform .4s}
.gear svg{transition:transform .5s cubic-bezier(.3,1.4,.5,1)}
.gear:hover svg,.gear[aria-expanded=true] svg{transform:rotate(60deg)}
.acct .dots circle{transition:opacity .25s}
.acct:hover .dots circle:not(.mid),.acct[aria-expanded=true] .dots circle:not(.mid){opacity:.25}
.acct.me{font:600 15px/1 Georgia,'Times New Roman',serif;text-transform:uppercase}
/* an admin's crown takes the place of the top-right crop mark: always there, it closes in with the others */
.acct.admin>i:nth-child(2){display:none}
.acct-crown{position:absolute;top:-3px;right:-2px;width:13px;height:11px;transform:rotate(18deg);transform-origin:50% 90%;pointer-events:none;transition:top .3s cubic-bezier(.3,1.5,.5,1),right .3s cubic-bezier(.3,1.5,.5,1)}
.acct:hover .acct-crown,.acct[aria-expanded=true] .acct-crown,.acct:focus-visible .acct-crown{top:0;right:1px}
.acct-crown svg,.pass-admin svg{display:block;width:100%;height:100%;fill:#F5B400;stroke:#DB9A00;stroke-width:1.8;stroke-linejoin:round;filter:drop-shadow(0 1px 2px rgba(245,180,0,.45))}
.acct:hover .acct-crown,.acct[aria-expanded=true] .acct-crown{animation:acct-wiggle .9s ease-in-out .1s}
@keyframes acct-wiggle{0%,100%{transform:rotate(18deg)}20%{transform:rotate(-4deg) scale(1.15)}45%{transform:rotate(26deg) scale(1.1)}70%{transform:rotate(12deg)}}
.pass-admin{display:inline-flex;align-items:center;gap:4px;font-weight:600;color:#B7791F;letter-spacing:.14em}
.pass-admin svg{width:12px;height:10px}
@media (prefers-reduced-motion:reduce){.acct .acct-crown{animation:none!important}}
@media (prefers-reduced-motion:reduce){.nav-ic>i,.nav-ic svg{transition:none}}
.acct-pop{position:absolute;top:calc(100% + 8px);right:16px;width:min(340px,calc(100vw - 24px));box-sizing:border-box;z-index:30;display:flex;flex-direction:column;gap:12px;${SHEET};padding:16px 20px 18px;box-shadow:0 18px 50px -12px rgba(0,0,0,.25),0 0 0 1px var(--mn-border)}
.acct-pop[hidden]{display:none}
.pass-head{display:flex;justify-content:space-between;padding-bottom:10px;margin-bottom:2px;border-bottom:1px dashed color-mix(in srgb,var(--mn-fg) 30%,transparent);font:500 10px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;color:color-mix(in srgb,var(--mn-fg) 55%,transparent)}
.pass-who{font:italic 17px/1.4 Georgia,'Times New Roman',serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pass-note{margin:0;font-size:12.5px;line-height:1.45;color:var(--mn-muted)}
.pass-links{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13.5px}
.pass-links a{color:var(--mn-accent);text-decoration:none}
.pass-links a:hover{text-decoration:underline}
.pass-out{border:0;background:none;padding:0;margin-left:auto;font:inherit;font-size:13.5px;color:var(--mn-muted);cursor:pointer}
.pass-out:hover{color:var(--mn-fg);text-decoration:underline}
.pass-stamp{position:absolute;right:18px;bottom:16px;padding:5px 10px;border:2px solid var(--mn-accent);outline:1px solid var(--mn-accent);outline-offset:2px;border-radius:4px;color:var(--mn-accent);font:700 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;transform:rotate(-8deg);opacity:.88;pointer-events:none;animation:pass-stamp .38s cubic-bezier(.3,1.6,.5,1) both;background:color-mix(in srgb,var(--mn-bg) 70%,transparent)}
@keyframes pass-stamp{from{transform:rotate(-8deg) scale(1.9);opacity:0}to{transform:rotate(-8deg) scale(1);opacity:.88}}
@media (prefers-reduced-motion:reduce){.pass-stamp{animation:none}}
@media (max-width:640px){.acct-pop{left:10px;right:10px;width:auto}}
.langs{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:1fr;border:1px solid var(--mn-border);border-radius:999px;padding:2px;background:var(--mn-panel);flex:none;isolation:isolate}
.langs::before{content:'';position:absolute;z-index:-1;top:2px;bottom:2px;left:2px;width:calc(50% - 2px);border-radius:999px;background:var(--mn-fg);transition:transform .42s cubic-bezier(.3,1.35,.45,1)}
.langs[data-on="1"]::before{transform:translateX(100%)}
.langs button{border:0;background:transparent;color:var(--mn-muted);font:inherit;font-size:12.5px;font-weight:600;padding:3px 10px;border-radius:999px;cursor:pointer;line-height:1.4;min-width:44px;transition:color .3s .08s}
.langs button[aria-pressed=true]{color:var(--mn-bg)}
@media (prefers-reduced-motion:reduce){.langs::before,.langs button{transition:none}}
.langs button:focus-visible{outline:2px solid var(--mn-accent);outline-offset:1px}
.page{max-width:1500px;margin:0 auto;padding:24px}
/* home: continue learning, all courses */
.section-title{font-size:13px;letter-spacing:.02em;color:var(--mn-muted);margin:26px 0 12px;font-weight:600}
.page>.section-title:first-child{margin-top:4px}
.resume-card{display:grid;grid-template-columns:minmax(0,320px) minmax(0,1fr);gap:20px;align-items:center;text-decoration:none;color:inherit;border-left:4px solid var(--course-accent,var(--mn-accent))}
.resume-card:hover,.resume-row:hover,.course-card:hover{border-color:var(--mn-accent)}
.resume-card:hover{border-left-color:var(--course-accent,var(--mn-accent))}
.resume-thumb{width:100%;aspect-ratio:16/9;border-radius:10px;border:1px solid var(--mn-border);background:linear-gradient(135deg,#f3f4f8,#e9ebf2);display:block}
.resume-text{display:flex;flex-direction:column;gap:8px;align-items:flex-start;min-width:0}
.resume-course{font-size:13px}
.resume-title{font-size:22px;font-weight:700;letter-spacing:-.01em;line-height:1.3}
.resume-text .course-progress{width:100%;max-width:360px}
.resume-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;margin-top:10px;text-decoration:none;color:inherit}
.resume-row-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.resume-row .mn-btn{flex:none}
.catalog{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}
.course-card{display:flex;flex-direction:column;gap:10px;transition:transform .15s,border-color .15s;border-top:4px solid var(--course-accent,var(--mn-border))}
.course-link{display:flex;flex-direction:column;gap:8px;text-decoration:none;color:inherit}
.course-resume{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;font-size:14px;text-decoration:none;color:var(--mn-fg);background:color-mix(in srgb,var(--course-accent,var(--mn-accent)) 8%,transparent)}
.course-resume b{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.course-resume:hover{background:color-mix(in srgb,var(--course-accent,var(--mn-accent)) 15%,transparent)}
.course-card:hover{transform:translateY(-2px)}
.course-card .thumb{width:100%;aspect-ratio:16/9;border-radius:10px;background:linear-gradient(135deg,#f3f4f8,#e9ebf2);border:1px solid var(--mn-border);display:block;object-fit:cover}
.course-name{font-weight:700;font-size:19px;letter-spacing:-.01em}
.course-sum{font-size:14px;line-height:1.55}
.course-card .meta{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--mn-muted)}
.course-progress{height:4px;border-radius:2px;background:var(--mn-faint);overflow:hidden}
.course-progress i{display:block;height:100%;background:var(--mn-good)}
/* home: courses the model made from slides, a section of their own drawn on the engineering sheet (zero-shot: one pass, no person editing) */
.gen-section{margin-top:34px;padding-top:6px;border-top:1px dashed var(--mn-border)}
.gen-lead{margin:-4px 0 14px;max-width:640px;font-size:14px;line-height:1.55;color:var(--mn-muted)}
.course-card.gen{position:relative;padding:18px;border:0;border-radius:2px;box-shadow:none;--g:color-mix(in srgb,var(--mn-fg) 16%,transparent);background:radial-gradient(var(--g) 1px,transparent 1.3px) 0 0/14px 14px,var(--mn-bg);transition:transform .15s,background-color .2s}
.course-card.gen:hover{border:0;--g:color-mix(in srgb,var(--mn-fg) 26%,transparent);transform:translateY(-2px)}
.course-card.gen>i{position:absolute;width:14px;height:14px;border:0 solid var(--mn-fg);pointer-events:none;transition:inset .35s cubic-bezier(.3,1.5,.5,1)}
.course-card.gen>i:nth-of-type(1){left:0;top:0;border-left-width:1.5px;border-top-width:1.5px}
.course-card.gen>i:nth-of-type(2){right:0;top:0;border-right-width:1.5px;border-top-width:1.5px}
.course-card.gen>i:nth-of-type(3){left:0;bottom:0;border-left-width:1.5px;border-bottom-width:1.5px}
.course-card.gen>i:nth-of-type(4){right:0;bottom:0;border-right-width:1.5px;border-bottom-width:1.5px}
.course-card.gen:hover>i:nth-of-type(1){left:7px;top:7px}
.course-card.gen:hover>i:nth-of-type(2){right:7px;top:7px}
.course-card.gen:hover>i:nth-of-type(3){left:7px;bottom:7px}
.course-card.gen:hover>i:nth-of-type(4){right:7px;bottom:7px}
@media (prefers-reduced-motion:reduce){.course-card.gen,.course-card.gen>i{transition:none}.course-card.gen:hover{transform:none}}
.gen-label{align-self:flex-start;font:500 10.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--course-accent,var(--mn-accent))}
.gen-tag{margin:2px 0 0;font:500 11px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;color:var(--course-accent,var(--mn-accent))}
/* the way to the courses made from one's own slides (pages/studio.ts) */
.studio-entry{display:inline-block;margin-top:26px;font-size:14px;color:var(--mn-muted);text-decoration:none}
.studio-entry:hover{color:var(--mn-accent)}
/* the way back (backlink.ts): "‹" and the words, in line with the page. Pointed at, two more arrows come in after the
   first (their room is kept, so nothing moves), a light runs leftwards through them, one dark among grey, and crop
   marks close in around it all. */
.backlink{position:relative;align-self:flex-start;display:inline-flex;align-items:center;gap:7px;margin:0 0 12px;padding:5px 12px 5px 8px;font-size:14px;color:var(--mn-muted);text-decoration:none;transition:color .15s}
.backlink:hover,.backlink:focus-visible{color:var(--mn-fg)}
.bk-arrows{display:inline-flex;gap:1px}
.bk-arrows i{display:block;width:6px;height:10px;font-style:normal;color:color-mix(in srgb,var(--mn-fg) 22%,transparent);transition:opacity .25s}
.bk-arrows i svg{display:block;width:6px;height:10px}
.bk-arrows i:nth-child(2),.bk-arrows i:nth-child(3){opacity:0}
.bk-arrows i:nth-child(1){color:currentColor}
.backlink:hover .bk-arrows i,.backlink:focus-visible .bk-arrows i{opacity:1;color:color-mix(in srgb,var(--mn-fg) 22%,transparent);animation:bk-run 1.5s ease-out infinite}
.backlink:hover .bk-arrows i:nth-child(2),.backlink:focus-visible .bk-arrows i:nth-child(2){animation-delay:.5s}
.backlink:hover .bk-arrows i:nth-child(1),.backlink:focus-visible .bk-arrows i:nth-child(1){animation-delay:1s}
@keyframes bk-run{0%{color:var(--mn-fg);transform:translateX(0)}24%{color:var(--mn-fg);transform:translateX(-2px)}33%,100%{color:color-mix(in srgb,var(--mn-fg) 22%,transparent);transform:translateX(0)}}
.backlink>b{position:absolute;width:5px;height:5px;border:0 solid currentColor;opacity:0;transition:inset .3s cubic-bezier(.3,1.5,.5,1),opacity .2s}
.backlink>b:nth-of-type(1){left:-4px;top:-4px;border-left-width:1.3px;border-top-width:1.3px}
.backlink>b:nth-of-type(2){right:-4px;top:-4px;border-right-width:1.3px;border-top-width:1.3px}
.backlink>b:nth-of-type(3){left:-4px;bottom:-4px;border-left-width:1.3px;border-bottom-width:1.3px}
.backlink>b:nth-of-type(4){right:-4px;bottom:-4px;border-right-width:1.3px;border-bottom-width:1.3px}
.backlink:hover>b,.backlink:focus-visible>b{opacity:1}
.backlink:hover>b:nth-of-type(1),.backlink:focus-visible>b:nth-of-type(1){left:0;top:0}
.backlink:hover>b:nth-of-type(2),.backlink:focus-visible>b:nth-of-type(2){right:0;top:0}
.backlink:hover>b:nth-of-type(3),.backlink:focus-visible>b:nth-of-type(3){left:0;bottom:0}
.backlink:hover>b:nth-of-type(4),.backlink:focus-visible>b:nth-of-type(4){right:0;bottom:0}
@media (prefers-reduced-motion:reduce){.backlink .bk-arrows i{animation:none!important}.backlink>b{transition:none}}
/* a course page */
/* a course page's header: what the course is and how to begin, its moving cover in a plain frame, and the route along the bottom */
.course-hero{padding:26px 28px 22px}
.hero-top{display:flex;align-items:center;gap:32px}
.hero-text{flex:1;display:flex;flex-direction:column;gap:6px;min-width:0}
.hero-text p{margin:0}
.hero-meta{font-size:13px;color:var(--mn-muted)}
.hero-meta b{font-weight:600;color:var(--course-accent,var(--mn-accent))}
.course-hero h1{font-size:38px;letter-spacing:-.025em;margin:0;line-height:1.15}
.hero-sum{font-size:16px}
.hero-go{margin-top:14px}
.hero-coming{margin:12px 0 4px;font-size:14px;color:var(--mn-muted)}
.hero-go .mn-btn{text-decoration:none}
.course-hero>.course-progress{margin-top:20px}
.lesson-card.up-next{border-color:var(--course-accent,var(--mn-accent));box-shadow:0 0 0 3px color-mix(in srgb,var(--course-accent,var(--mn-accent)) 18%,transparent),var(--mn-shadow)}
.up-next-tag{align-self:flex-start;margin-top:2px;padding:7px 14px;border-radius:999px;background:var(--mn-fg);color:var(--mn-bg);font-size:13.5px;font-weight:600}
.lesson-done{min-height:50vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-size:22px;animation:ld-in .5s cubic-bezier(.2,.8,.2,1) both}
.ld-check{display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:var(--mn-good);color:#fff;font-size:30px;animation:ld-pop .6s cubic-bezier(.3,1.6,.5,1) .1s both}
@keyframes ld-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ld-pop{from{transform:scale(.4)}to{transform:none}}
/* the mastery percentage is not shown: it read as a failing mark */
.mn-mastery{display:none!important}
.hero-review{display:inline-block;margin-top:16px;font-size:13.5px;color:var(--course-accent,var(--mn-accent));text-decoration:none}
.hero-review:hover{text-decoration:underline}
/* the cover is the course's signature animation, in proportion, framed like the lesson pictures; a click replays it */
.hero-feature{flex:none;position:relative;margin:0;height:196px;aspect-ratio:16/9;border:1px solid var(--mn-border);border-radius:12px;overflow:hidden;background:#fff;cursor:pointer}
.hero-feature img,.hero-feature canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.hero-feature canvas{visibility:hidden}
.hero-feature.live canvas{visibility:visible}
.hero-feature.live img{visibility:hidden}
/* the learning map, a level route: stops (a check when cleared, the next one pulsing) and a crown at the end */
.milestones{list-style:none;margin:26px 0 0;padding:0;display:flex;position:relative;isolation:isolate}
.milestones .ms{flex:1;position:relative;min-width:0}
.milestones .ms::after,.milestones .ms.done::before{content:'';position:absolute;top:8px;left:9px;right:0;height:2px;background:var(--mn-border)}
.milestones .ms.done::before{background:var(--course-accent,var(--mn-accent));z-index:1}
.milestones a{position:relative;z-index:2;display:inline-flex;flex-direction:column;align-items:flex-start;gap:8px;padding-right:10px;text-decoration:none;color:var(--mn-muted);font-size:13px;line-height:1.3;word-break:keep-all}
.milestones i{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:var(--mn-panel);border:2px solid var(--mn-border);box-sizing:border-box;transition:transform .15s}
.milestones i svg{width:12px;height:12px;fill:none;stroke:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.milestones .done i{background:var(--course-accent,var(--mn-accent));border-color:var(--course-accent,var(--mn-accent))}
.milestones .done i svg{stroke:#fff}
.milestones .next i{border-color:var(--course-accent,var(--mn-accent));animation:ms-ping 2.2s ease-out infinite}
.milestones .done a,.milestones .next a{color:var(--mn-fg)}
.milestones .next a{font-weight:600}
.milestones a:hover{color:var(--course-accent,var(--mn-accent))}
.milestones a:hover i{transform:scale(1.15)}
.milestones .goal{flex:none;position:relative;z-index:2;margin-top:-2px}
.milestones .goal svg{display:block;width:26px;height:22px;fill:var(--mn-panel);stroke:#a9adb3;stroke-width:1.8;stroke-linejoin:round}
.milestones .goal.won svg{fill:#F5B400;stroke:#DB9A00;filter:drop-shadow(0 1px 4px rgba(245,180,0,.45))}
.milestones .goal{cursor:grab;touch-action:none;user-select:none}
.milestones .goal.held{cursor:grabbing}
.milestones .goal.held svg{transition:none}
.milestones .goal.away svg{opacity:.18}
.milestones .route-light{position:absolute;left:0;top:0;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#F5B400;box-shadow:0 0 10px 3px rgba(245,180,0,.55);pointer-events:none;z-index:3}
.course-hero h1 .title-crown{display:inline-block;vertical-align:top;margin:-14px 0 0 4px;padding:0;border:0;background:none;cursor:pointer;transform:rotate(-14deg)}
.course-hero h1 .title-crown svg{display:block;width:30px;height:25px;fill:#F5B400;stroke:#DB9A00;stroke-width:1.8;stroke-linejoin:round;filter:drop-shadow(0 1px 4px rgba(245,180,0,.45))}
/* cleared since last seen: the node pops, the check draws, the route runs on to the next stop; sparks fly */
.milestones .fresh i{animation:ms-pop .6s cubic-bezier(.3,1.7,.5,1) var(--d) both}
.milestones .fresh i path{stroke-dasharray:10;animation:ms-check .3s ease-out calc(var(--d) + .25s) both}
.milestones .ms.fresh::before{transform-origin:left;animation:ms-run .45s ease-in-out calc(var(--d) + .3s) both}
.milestones .goal.fresh svg{animation:ms-crown .9s cubic-bezier(.3,1.7,.5,1) var(--d) both}
.milestones .goal.wiggle svg{transform-origin:50% 85%;animation:ms-wiggle 1s ease-in-out var(--w) both}
.milestones .spark{position:absolute;left:9px;top:9px;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:var(--course-accent,var(--mn-accent));pointer-events:none;animation:ms-spark .65s ease-out both}
.milestones .goal .spark{left:13px;top:11px;background:#F5B400}
@keyframes ms-ping{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--course-accent,var(--mn-accent)) 45%,transparent)}75%,100%{box-shadow:0 0 0 9px transparent}}
@keyframes ms-pop{from{background:var(--mn-panel);border-color:var(--mn-border);transform:scale(.8)}55%{transform:scale(1.4)}to{transform:scale(1)}}
@keyframes ms-check{from{stroke-dashoffset:10}to{stroke-dashoffset:0}}
@keyframes ms-run{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes ms-crown{from{fill:var(--mn-panel);stroke:var(--mn-border);transform:scale(.6) rotate(-14deg)}55%{transform:scale(1.5) rotate(8deg)}to{transform:none}}
@keyframes ms-wiggle{0%,100%{transform:none}12%{transform:scale(1.15) rotate(-16deg);fill:#FCE7A6;stroke:#E0A800}28%{transform:scale(1.15) rotate(13deg);fill:#FCE7A6;stroke:#E0A800}44%{transform:scale(1.1) rotate(-9deg);fill:#FCE7A6;stroke:#E0A800}60%{transform:rotate(6deg)}76%{transform:rotate(-3deg)}}
@keyframes ms-spark{0%{opacity:0;transform:none}10%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.4)}}
@media (prefers-reduced-motion:reduce){.milestones .next i{animation:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--course-accent,var(--mn-accent)) 18%,transparent)}}
.about-course{margin-top:14px;padding:14px 18px}
.about-course>summary{cursor:pointer;font-size:14px;color:var(--mn-muted);list-style:none;display:flex;align-items:center;gap:8px}
.about-course>summary::before{content:'›';font-size:18px;line-height:1;transition:transform .15s}
.about-course[open]>summary::before{transform:rotate(90deg)}
.about-course>summary::-webkit-details-marker{display:none}
.about-body{display:flex;flex-direction:column;gap:16px;margin-top:14px;font-size:14px;line-height:1.65}
.about-lead{margin:0;font-size:14.5px;color:var(--mn-fg)}
.about-sec h3{margin:0 0 6px;font-size:12.5px;font-weight:600;color:var(--mn-muted);letter-spacing:.02em}
.about-sec ul{margin:0;padding-left:1.15em;display:flex;flex-direction:column;gap:4px;font-size:14px}
.about-sec a{color:var(--mn-fg);text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--mn-fg) 25%,transparent);text-underline-offset:3px}
.about-sec a:hover{color:var(--mn-accent);text-decoration-color:currentColor}
.about-body p{margin:0}
.lesson-title{font-weight:600;font-size:16px;display:flex;gap:8px;align-items:baseline}
.lesson-title .status{flex:none;font-size:13px;width:16px;text-align:center;color:var(--mn-muted)}
.status-done .lesson-title .status{color:var(--mn-good)}
.status-started .lesson-title .status{color:var(--mn-accent)}
.kinds{display:inline-flex;gap:5px;color:var(--mn-muted);align-items:center}
.labs-soon{font-size:14px}
.lab-card{display:flex;flex-direction:column;gap:8px;text-decoration:none;color:inherit;transition:transform .15s,border-color .15s}
.lab-card:hover{transform:translateY(-2px);border-color:var(--mn-accent)}
.lab-head{display:flex;gap:8px;align-items:baseline}
.lab-id{flex:none;font:600 12px ui-monospace,Menlo,monospace;color:#7C3AED;background:color-mix(in srgb,#7C3AED 10%,transparent);padding:2px 6px;border-radius:6px}
.lab-head .lesson-title{display:block}
.lab-sum{font-size:13.5px;line-height:1.5}
.lab-card .meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--mn-muted);margin-top:auto}
.lab-after{font-size:13.5px;margin:-4px 0 12px}
.lab-after a{color:var(--mn-accent)}
/* the breadcrumb above a lesson */
.crumb{font-size:13px;color:var(--mn-muted);margin:0 0 10px}
.crumb a{color:var(--mn-muted);text-decoration:none}
.crumb a:hover{color:var(--mn-accent);text-decoration:underline}
.tag.done-tag{background:color-mix(in srgb,var(--mn-good) 12%,transparent);color:var(--mn-good)}
.hero{display:grid;grid-template-columns:1.2fr 1fr;gap:24px;align-items:start}
.card{background:var(--mn-panel);border:1px solid var(--mn-border);border-radius:var(--mn-radius);padding:18px;box-shadow:var(--mn-shadow)}
.card h2{margin:0 0 6px;font-size:18px}
.muted{color:var(--mn-muted)}
.units{display:flex;flex-direction:column;gap:22px;margin-top:26px}
.unit h3{margin:0 0 10px;font-size:15px;font-weight:650;letter-spacing:-.005em;color:var(--mn-fg)}
.lessons{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.lesson-card{display:flex;flex-direction:column;gap:8px;cursor:pointer;transition:transform .15s,border-color .15s;text-decoration:none;color:inherit}
.lesson-card:hover{transform:translateY(-2px);border-color:var(--mn-accent)}
.lesson-card .thumb{width:100%;aspect-ratio:16/9;border-radius:10px;background:linear-gradient(135deg,#f3f4f8,#e9ebf2);border:1px solid var(--mn-border);display:block}
.lesson-card .thumb.empty{background:linear-gradient(135deg,color-mix(in srgb,var(--mn-accent) 10%,#fff),#f3f4f8)}
.lesson-card .meta{display:flex;justify-content:space-between;font-size:12px;color:var(--mn-muted)}
.tag{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--mn-faint);color:var(--mn-muted)}
.tag.ai{background:color-mix(in srgb,var(--mn-accent) 12%,transparent);color:var(--mn-accent)}
.ring{display:flex;gap:4px}
.ring i{flex:1;height:5px;border-radius:3px;background:var(--mn-faint)}
.ring i.m{background:var(--mn-good)}.ring i.p{background:var(--mn-accent)}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.stat{font-size:28px;font-weight:700;letter-spacing:-.02em}
.bars{display:flex;flex-direction:column;gap:10px}
.bar{display:grid;grid-template-columns:220px 1fr 84px;gap:12px;align-items:center;font-size:14px}
.bar>span:last-child{white-space:nowrap}.bar .track{height:8px;background:var(--mn-faint);border-radius:4px;overflow:hidden}.bar .track i{display:block;height:100%;background:var(--mn-accent)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.col{display:flex;flex-direction:column;gap:16px}
label.field{display:flex;flex-direction:column;gap:6px;font-size:14px}
@media (max-width:900px){.hero,.grid2,.resume-card{grid-template-columns:minmax(0,1fr)}.bar{grid-template-columns:1fr 1fr 84px}}
@media (max-width:640px){.catalog{grid-template-columns:minmax(0,1fr)}.course-hero{padding:18px}.hero-top{flex-direction:column;align-items:stretch;gap:18px}.hero-feature{order:-1;height:auto;width:100%}.course-hero h1{font-size:26px}.milestones{flex-direction:column;margin-top:20px}.milestones .ms{flex:none;padding-bottom:14px}.milestones .ms::after,.milestones .ms.done::before{top:9px;bottom:-9px;left:8px;right:auto;width:2px;height:auto}.milestones a{flex-direction:row;align-items:center;gap:12px;font-size:14px;padding-right:0}.milestones .goal{margin:0 0 0 -4px}.resume-title{font-size:18px}.app-shell{--mn-sticky-top:52px}.nav{gap:14px;padding:12px 14px}.langs{margin-left:auto}.page{padding:16px 12px}
 .bar{grid-template-columns:1fr 84px;row-gap:4px}.bar .track{grid-column:1/-1;grid-row:2}}
/* phones: logo and language on top, a tab bar at the bottom (not inside lessons) */

@media (max-width:420px){.nav .brand .name{display:none}.nav{gap:11px;padding:12px 10px}.nav a{font-size:13.5px}.langs button{padding:3px 7px}}
`;

export type Page = (root: HTMLElement, route: Route) => void | (() => void) | Promise<void | (() => void)>;
let cleanup: (() => void) | void;
let relocalizing = false;
/** True while the page is re-rendered for a new language (a lesson stays on its step). */
export const is_relocalizing = () => relocalizing;
const LOGO = '<svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="var(--mn-accent)" stroke-width="3"/><path d="M6 22 L16 8 L26 22" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
// (a symmetric gear, centred on the middle of its box)
const GEAR = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';

/** An admin wears the course map's crown on their initial (and on their pass); everything else is the learner's view. */
const CROWN = '<svg viewBox="0 0 24 20"><path d="M3 17V6.5l5 4.5 4-7 4 7 5-4.5V17z"/></svg>';
/** The four crop marks that hold each tool of the top bar. */
const CORNERS = '<i></i><i></i><i></i><i></i>';
/** Signed out, the account is a blank sheet: the margin's dot grid, three by three. */
const SHEET_ICON = `<svg class="dots" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${[2.5, 8, 13.5].flatMap((y) => [2.5, 8, 13.5].map((x) => `<circle${x === 8 && y === 8 ? ' class="mid" r="1.6"' : ' r="1.15"'} cx="${x}" cy="${y}"/>`)).join('')}</svg>`;

export function mount_shell(pages: Record<Route['page'], Page>): void {
  inject_styles();
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app')!;
  app.className = 'app-shell' + (load_settings().dark ? ' dark' : '');
  const nav = document.createElement('nav');
  nav.className = 'nav';
  const page = document.createElement('main');
  page.className = 'page';
  app.append(nav, page);
  // settings: a panel that drops from the gear (closed by a click elsewhere, Escape, or going to another page)
  const pop = document.createElement('div');
  pop.className = 'set-pop card';
  pop.hidden = true;
  const close_settings = () => {
    pop.hidden = true;
    nav.querySelector('.gear')?.setAttribute('aria-expanded', 'false');
  };
  // the account card drops from its button the same way
  const acct_pop = document.createElement('div');
  acct_pop.className = 'acct-pop card';
  acct_pop.hidden = true;
  const close_account = () => {
    acct_pop.hidden = true;
    nav.querySelector('.acct')?.setAttribute('aria-expanded', 'false');
  };
  document.addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !pop.contains(e.target as Node) && !(e.target as Element).closest?.('.gear')) close_settings();
    if (!acct_pop.hidden && !acct_pop.contains(e.target as Node) && !(e.target as Element).closest?.('.acct')) close_account();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    close_settings();
    close_account();
  });
  // the pass: its number (from the account id) once there is an account, the sign-in form until then
  const pass_head = (n: string, admin = false) =>
    `<div class="pass-head"><span>LAB PASS${admin ? ` · <b class="pass-admin">${CROWN}ADMIN</b>` : ''}</span><span>№ ${esc(n)}</span></div>`;
  let stamping = false;
  const account_card = () => {
    const me = current_user();
    if (!me) {
      acct_pop.innerHTML = `${pass_head('— — — —')}<p class="pass-note">${esc(t(studio_available() ? 'account_help' : 'account_help_progress'))}</p>`;
      acct_pop.append(
        login_form(() => {
          // admitted: the pass is stamped, then it puts itself away (the top bar already shows the badge)
          stamping = true;
          const id = current_user()?.id ?? '';
          acct_pop.querySelector('.pass-head span:last-child')!.textContent = `№ ${id.slice(0, 4).toUpperCase()}`;
          acct_pop.insertAdjacentHTML('beforeend', `<div class="pass-stamp">${esc(t('admitted'))}</div>`);
          setTimeout(() => {
            stamping = false;
            close_account();
          }, 1100);
        }),
      );
      return;
    }
    acct_pop.innerHTML = `${pass_head(me.id.slice(0, 4).toUpperCase(), me.admin)}<div class="pass-who" title="${esc(me.email)}">${esc(me.email)}</div>
      <div class="pass-links">${studio_available() ? `<a href="/studio">${esc(t('my_studio'))}</a>` : ''}<button type="button" class="pass-out">${esc(t('sign_out'))}</button></div>`;
    acct_pop.querySelector<HTMLButtonElement>('.pass-out')!.onclick = () => {
      close_account();
      void sign_out();
    };
  };
  let current: Route = parse(location.pathname);
  const render_nav = () => {
    const lang = ui_lang();
    const me = current_user();
    const acct = !accounts_available()
      ? ''
      : me
        ? `<button type="button" class="nav-ic acct me${me.admin ? ' admin' : ''}" aria-label="${esc(me.email)}" title="${esc(me.email)}" aria-expanded="false">${CORNERS}${esc(me.email.slice(0, 1))}${me.admin ? `<span class="acct-crown" aria-hidden="true">${CROWN}</span>` : ''}</button>`
        : `<button type="button" class="nav-ic acct" aria-label="${esc(t('sign_in'))}" title="${esc(t('sign_in'))}" aria-expanded="false">${CORNERS}${SHEET_ICON}</button>`;
    nav.innerHTML = `<a class="brand" href="/">${LOGO}<span class="name">Mathnim</span></a>
      <span class="nav-tools">${acct}<button type="button" class="nav-ic gear" aria-label="${t('nav_settings')}" title="${t('nav_settings')}" aria-expanded="false">${CORNERS}${GEAR}</button></span>`;
    nav.append(pop, acct_pop);
    const acct_btn = nav.querySelector<HTMLButtonElement>('.acct');
    if (acct_btn)
      acct_btn.onclick = () => {
        if (!acct_pop.hidden) return close_account();
        close_settings();
        account_card();
        acct_pop.hidden = false;
        acct_btn.setAttribute('aria-expanded', 'true');
        acct_pop.querySelector('input')?.focus();
      };
    const gear = nav.querySelector<HTMLButtonElement>('.gear')!;
    gear.onclick = () => {
      if (!pop.hidden) return close_settings();
      close_account();
      pop.replaceChildren(settings_panel());
      pop.hidden = false;
      gear.setAttribute('aria-expanded', 'true');
    };
    app.classList.toggle('in-lesson', current.page === 'lesson' || current.page === 'lab');
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  };
  let routing = 0;
  const route = async (keep_scroll = false) => {
    const mine = ++routing;
    if (typeof cleanup === 'function') cleanup();
    cleanup = undefined;
    hush_all(); // whatever was speaking belonged to the page being left
    current = parse(location.pathname);
    // one address per lesson: a lesson reached under another course's slug moves to its own
    if (current.page === 'lesson') {
      const canonical = lesson_path(current.lesson);
      if (canonical !== location.pathname) history.replaceState(null, '', canonical + location.search);
    }
    // (a new language keeps the settings open, re-set in it; any other page closes them)
    if (!relocalizing) close_settings();
    else if (!pop.hidden) pop.replaceChildren(settings_panel());
    if (!stamping) close_account();
    render_nav();
    if (!pop.hidden) nav.querySelector('.gear')?.setAttribute('aria-expanded', 'true');
    page.innerHTML = '';
    if (!keep_scroll) window.scrollTo(0, 0);
    const done = await pages[current.page](page, current);
    // the learner went elsewhere while this page was loading: take it down now (no sound left playing)
    if (mine !== routing) {
      if (typeof done === 'function') done();
      return;
    }
    cleanup = done;
    // an anchor in the address (e.g. /llm-finetuning#labs) is scrolled to once the page is there
    if (!keep_scroll && location.hash.length > 1 && !location.hash.startsWith('#/')) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  };
  set_router(() => void route());
  intercept_links(document);
  window.addEventListener('popstate', () => void route());
  // old hash links (#/lesson/<id> ...) land on their new paths
  const legacy = legacy_path(location.hash);
  if (legacy) history.replaceState(null, '', legacy);
  window.addEventListener('hashchange', () => {
    const p = legacy_path(location.hash);
    if (p) navigate(p, true);
  });
  // a new language re-renders the page in place (a lesson keeps its step, see pages/lesson.ts)
  on_ui_lang(async () => {
    relocalizing = true;
    const y = window.scrollY;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      // the page is re-set in the new language: the old words soften away, the new ones rise in (the top bar stays)
      if (!still) await page.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(4px)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' }).finished;
      await route(true);
    } finally {
      relocalizing = false;
    }
    window.scrollTo(0, y);
    page.getAnimations().forEach((a) => a.cancel()); // (the fade-out held the page hidden)
    if (!still) page.animate([{ opacity: 0, filter: 'blur(4px)', transform: 'translateY(8px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
  void route();
}
