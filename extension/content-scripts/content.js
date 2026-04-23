var content=(function(){var e=Object.defineProperty,t=(e,t)=>()=>(e&&(t=e(e=0)),t),n=(t,n)=>{let r={};for(var i in t)e(r,i,{get:t[i],enumerable:!0});return n||e(r,Symbol.toStringTag,{value:`Module`}),r};function r(e){return e}function i(e){return e.replace(/\s+/g,` `).trim()}function a(e,t){if(!e)return``;try{let n=new URL(e,t);return`${n.origin}${n.pathname}`}catch{return e}}function o(e){let t=e.replace(/,/g,``),n=t.match(/(\d+(?:\.\d+)?)\s*[-~]\s*(\d+(?:\.\d+)?)\s*(?:元|人民币|RMB)/i);if(n)return{min:Math.round(parseFloat(n[1])),max:Math.round(parseFloat(n[2]))};let r=t.match(/(\d+(?:\.\d+)?)\s*[-~]\s*(\d+(?:\.\d+)?)\s*(k|K|千)/);if(r)return{min:Math.round(parseFloat(r[1])*1e3),max:Math.round(parseFloat(r[2])*1e3)};let i=t.match(/(\d+(?:\.\d+)?)\s*[-~]\s*(\d+(?:\.\d+)?)\s*(万)/);return i?{min:Math.round(parseFloat(i[1])*1e4),max:Math.round(parseFloat(i[2])*1e4)}:{min:null,max:null}}function s(e,t,n,r){let i=`${e}::${r||`${t}::${n}`}`,a=0;for(let e=0;e<i.length;e++)a=(a<<5)-a+i.charCodeAt(e),a|=0;return`offeru-${e}-${Math.abs(a).toString(36)}`}var c=t((()=>{})),l,u=t((()=>{l={source:`boss`,hostPattern:/(?:^|\.)zhipin\.com$/i,listCard:`li.job-card-box, .job-list li.job-card-box, .job-card-wrap, li.job-card-wrap, .rec-job-list .job-card-wrap`,listActionTargets:[`.job-info`,`.job-card-left`,`.job-card-wrap`,`.info-public`],listTitle:[`.job-name`,`.job-title`,`.job-card-body .job-name`,`.job-name-wrap .job-name`],listCompany:[`.company-name a`,`.company-name`,`.boss-name`,`.company-info h3`,`.company-info .company-name`],listSalary:[`.salary`],listLocation:[`.job-area`,`.job-area-wrapper`,`.job-card-footer .job-area`],listLink:[`a[href*='job_detail']`,`a.job-card-left`,`.job-card-body a`,`a`],listTags:[`.tag-list li`,`.job-info .tag-list span`],listCompanyTags:[`.company-tag-list li`],detailTitle:[`.info-primary .name`,`.name h1`,`.job-title`,`.job-name`,`h1`],detailCompany:[`.company-info .name`,`.company-info a`,`.company-name`,`.boss-name`,`.company-info h3`],detailSalary:[`.salary`],detailLocation:[`.location-address`,`.job-location .location-address`,`.job-location`,`.job-location-text`],detailDescription:[`.job-sec-text`,`.job-detail .job-sec-text`,`.job-card-body .job-sec-text`,`.job-detail-box .job-sec-text`,`.job-detail-box .text`,`.job-detail-section .text`,`.job-description`,`.job-detail-section`,`.job-detail-box`,`.job-detail`],detailApplyLink:[`a.btn-startchat`,`a.op-btn.op-btn-chat`,`a[data-url*='friend/add']`,`a[href*='job_detail']`],detailPostedAt:[`.job-author .time`,`.job-author span:last-child`,`.job-author span`],detailTags:[`.job-tags .tag-item`,`.tag-list li`,`.job-label-list li`],detailCompanyTags:[`.company-info p`,`.sider-company p`,`.company-tag-list li`,`.company-info .tag-item`],detailPathHint:/job_detail/i}})),d,f=t((()=>{d={source:`liepin`,hostPattern:/(?:^|\.)liepin\.com$/i,listCard:`.job-card-pc-container, .job-list-item, .job-item`,listActionTargets:[`.job-card-pc-container__header`,`.job-title-box`,`.job-item`],listTitle:[`.job-title-box a`,`.job-title`,`.ellipsis-1`],listCompany:[`.company-name`,`.company-name a`,`.company-title`],listSalary:[`.job-salary`,`.salary`],listLocation:[`.job-dq`,`.job-dq-box .ellipsis-1`,`.job-card-pc-container .job-dq`,`.job-area`,`.city`],listLink:[`a[href*='job']`,`a`],listTags:[`.job-labels-box span`,`.labels span`],listCompanyTags:[`.company-tags span`,`.company-tags li`],detailTitle:[`.job-title-box .name`,`.job-title`,`h1`],detailCompany:[`.company-name`,`.company-name a`,`.company-title`],detailSalary:[`.job-salary`,`.salary`],detailLocation:[`section.job-apply-container div.job-properties > span:first-child`,`.job-apply-container .job-properties span:first-child`,`.basic-infor .job-address`,`.job-address`,`.city`],detailDescription:[`.job-intro-container [data-selector='job-intro-content']`,`.job-intro-container .paragraph dd[data-selector='job-intro-content']`,`dd[data-selector='job-intro-content']`,`.job-intro-container .paragraph dd`,`.job-content`,`.content-word`,`.job-detail-content`,`.job-main-content`,`.job-detail-box`,`.job-description`],detailApplyLink:[`a[href*='deliver']`,`a[href*='apply']`],detailPostedAt:[`.update-time`,`.job-update-time`,`.job-title-box .update-time`,`.basic-infor .time`],detailTags:[`.job-qualifications span`,`.job-labels-box span`],detailCompanyTags:[`.company-other span`,`.company-tags span`],detailPathHint:/\/(?:job|a)\/\d+(?:\.shtml)?\/?$/i}})),p,m=t((()=>{p={source:`zhaopin`,hostPattern:/(?:^|\.)zhaopin\.com$/i,listCard:`.joblist-box__item, .positionlist__list-item, .joblist-item`,listActionTargets:[`.jobinfo__top`,`.jobinfo`,`.positionlist__item`],listTitle:[`.jobinfo__name`,`.job-title`,`.position-name`],listCompany:[`.company__name`,`.company-name`,`.company-title`],listSalary:[`.jobinfo__salary`,`.salary`],listLocation:[`.jobinfo__other-info .jobinfo__other-info-item span`,`.jobinfo__other-info-item span`,`.jobinfo__area`,`.job-area`,`.job-address`],listLink:[`a[href*='/jobdetail/']`,`a[href*='jobs.zhaopin.com']`,`a`],listTags:[`.jobinfo__tag span`,`.tag-box span`],listCompanyTags:[`.company__info span`,`.company-tag span`],detailTitle:[`.summary-planes__title`,`.jobdetail-box__title`,`.job-name`,`h1`],detailCompany:[`.company-name`,`.company-name a`,`.company__name`],detailSalary:[`.summary-planes__salary`,`.salary`,`.jobdetail-box__salary`,`.jobs-deliver__salary`],detailLocation:[`.summary-planes__info li:first-child`,`.summary-planes__info li span`,`.address-info__bubble`,`.jobdetail-box__job-address`,`.job-address`],detailDescription:[`.describtion-card__detail-content`,`.describtion-card .describtion-card__detail-content`,`.describtion__detail-content`,`.describtion`,`.describtion-card`,`.jobdetail-box__content`,`.job-description`,`.pos-ul`,`[class*='describtion']`],detailApplyLink:[`a.apply-btn`,`a[href*='apply']`],detailPostedAt:[`.summary-planes__time`,`.jobdetail-box__job-date`,`.jobdetail-box__update-time`,`.job-detail .job-date`,`.job-detail .update-time`],detailTags:[`.job-require span`,`.jobdetail-box__labels span`],detailCompanyTags:[`.company__info span`,`.company-intro__item`],detailPathHint:/\/jobdetail\//i}})),h,g=t((()=>{h={source:`shixiseng`,hostPattern:/(?:^|\.)shixiseng\.com$/i,listCard:`.intern-item, .position-item, .intern-wrap .intern-item`,listActionTargets:[`.intern-detail`,`.intern-item__bd`,`.position-item`],listTitle:[`.job-name`,`.name`,`.title a`],listCompany:[`.company-name`,`.company-info .name`,`.company`],listSalary:[`.day-salary`,`.salary`],listLocation:[`.area`,`.city`,`.address`],listLink:[`a[href*='/intern/']`,`a`],listTags:[`.more span`,`.job-tags span`],listCompanyTags:[`.company-more span`,`.company-tags span`],detailTitle:[`.new_job_name`,`.job-name`,`h1`],detailCompany:[`.com-name`,`.company-name`,`.company-info .name`],detailSalary:[`.job_money`,`.salary`],detailLocation:[`.job_position`,`.position`,`.city`],detailDescription:[`.intern_position_detail`,`.job_part .job_detail .intern-from-api`,`.job_detail .intern-from-api`,`.job_detail`,`.detail-content`,`.job-desc`,`[class*='position_detail']`,`[class*='job_detail']`],detailApplyLink:[`a.apply-btn`,`a[href*='delivery']`],detailPostedAt:[`.job_publish_time`,`.publish_time`,`.job_msg .cutom_font`,`.job_msg span`],detailTags:[`.job_msg span`,`.job-tags span`],detailCompanyTags:[`.com_msg span`,`.company-tags span`],detailPathHint:/\/intern\/[^/?#]+/i}})),_,v=t((()=>{_={source:`linkedin`,hostPattern:/(?:^|\.)linkedin\.(?:com|cn)$/i,listCard:`.jobs-search-results__list-item, .job-card-container, li.scaffold-layout__list-item`,listActionTargets:[`.job-card-container__content`,`.job-card-list__entity-lockup`,`.job-card-container`],listTitle:[`.base-search-card__title`,`.job-card-list__title`,`h3`],listCompany:[`.base-search-card__subtitle`,`.job-card-container__company-name`,`.artdeco-entity-lockup__subtitle`],listSalary:[`.salary`,`.compensation__salary`],listLocation:[`.job-search-card__location`,`.job-card-container__metadata-item`],listLink:[`a.base-card__full-link`,`a.job-card-list__title`,`a[href*='/jobs/view/']`,`a[href*='/incareer/jobs/view/']`],listTags:[`.job-card-container__metadata-wrapper li`,`.job-card-container__footer-item`],listCompanyTags:[`.job-card-container__metadata-item`,`.job-card-container__insight`],detailTitle:[`.job-details-jobs-unified-top-card__job-title`,`h1.t-24`,`h1`],detailCompany:[`.job-details-jobs-unified-top-card__company-name`,`.jobs-unified-top-card__company-name`],detailSalary:[`.salary`,`.compensation__salary`],detailLocation:[`.job-details-jobs-unified-top-card__bullet`,`.jobs-unified-top-card__bullet`],detailDescription:[`.jobs-description-content__text`,`.jobs-description__content`,`.jobs-box__html-content`,`.show-more-less-html__markup`,`[class*='description__text']`,`[class*='jobs-description']`],detailApplyLink:[`a.jobs-apply-button`,`a[data-control-name='jobdetails_topcard_inapply']`],detailPostedAt:[`.jobs-unified-top-card__tertiary-description-container .tvm__text`,`.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text`],detailTags:[`.job-details-preferences-and-skills__pill`,`.job-details-how-you-match__skills-item-subtitle`],detailCompanyTags:[`.jobs-company__box li`,`.jobs-company__inline-information li`],detailPathHint:/(?:jobs\/view|incareer\/jobs\/view)/i}})),y,b=t((()=>{u(),f(),m(),g(),v(),y=[l,d,p,h,_]})),x=n({});function S(e){return i(e?.textContent||``)}function C(e,t){for(let n of t){let t=e.querySelector(n);if(t)return t}return null}function w(e,t){for(let n of t){let t=e.querySelectorAll(n);for(let e of Array.from(t)){let t=S(e);if(t)return t}}return``}function T(e,t){let n=[];for(let r of t)if(e.querySelectorAll(r).forEach(e=>{let t=S(e);t&&n.push(t)}),n.length>0)break;return n}function ee(e,t){for(let n of t){let t=e.querySelector(n);if(!t)continue;let r=t.href||t.getAttribute(`href`)||``;if(r)try{return a(new URL(r,window.location.href).href,window.location.href)}catch{return r}}return``}function E(e,t){return e.find(e=>t.test(e))||``}function D(e){return e?i(e).replace(/[|｜]/g,` `).replace(/\s+/g,` `).replace(/(?:^工作地点[:：]?|^职位地址[:：]?|^工作地址[:：]?)/,``).trim():``}function O(e){if(!e)return``;let t=D(e);for(let e of jt)if(t.includes(e))return e;return t.split(/[\-·\/｜|,，\s]/).find(e=>/[\u4e00-\u9fa5]{2,8}/.test(e))||``}function k(e){if(!e)return-999;let t=D(e),n=0;return t?(/([\u4e00-\u9fa5]{2,})/.test(t)&&(n+=2),t.length>=2&&t.length<=26&&(n+=1),(t.includes(`-`)||t.includes(`·`))&&(n+=1),xt.test(t)&&(n-=7),t.length>42&&(n-=2),O(t)&&(n+=6),n):-999}function A(e){let t=new Set,n=[];for(let r of e){let e=D(r);!e||t.has(e)||(t.add(e),n.push(e))}return n}function te(e){let t=/^(工作地点|职位地址|工作地址|地址)[:：]?/,n=e.querySelectorAll(`dt,dd,div,span,p,strong,label`);for(let e of Array.from(n)){let n=D(e.textContent||``);if(!n||!t.test(n))continue;let r=n.replace(t,``).trim();if(r)return r;let i=e.nextElementSibling,a=D(i?.textContent||``);if(a)return a}return``}function j(e,t){if(!e)return;if(Array.isArray(e)){e.forEach(e=>j(e,t));return}if(typeof e!=`object`)return;let n=e;if(String(n[`@type`]||``).toLowerCase()===`jobposting`){let e=n.jobLocation;e&&j(e,t)}let r=n.addressLocality;typeof r==`string`&&t.push(r);let i=n.addressRegion;typeof i==`string`&&t.push(i);let a=n.streetAddress;typeof a==`string`&&t.push(a);let o=n.address;o&&j(o,t);let s=n[`@graph`];s&&j(s,t)}function M(e){let t=Array.from(e.querySelectorAll(`script[type='application/ld+json']`));if(t.length===0)return[];let n=[];for(let e of t){let t=e.textContent?.trim();if(t)try{j(JSON.parse(t),n)}catch{continue}}return A(n)}function N(e,t,n){let r=[t,n];e===`detail`?(r.push(w(document,[`section.job-apply-container div.job-properties > span:first-child`,`.job-apply-container .job-properties span:first-child`,`.job-dq-box .ellipsis-1`])),r.push(te(document))):r.push(w(document,[`.job-dq-box .ellipsis-1`,`.job-card-pc-container .job-dq`,`section.job-apply-container div.job-properties > span:first-child`])),r.push(...M(document));let i=O(document.title||``);i&&r.push(i);let a=A(r);if(a.length===0)return``;let o=a[0],s=k(o);for(let e=1;e<a.length;e+=1){let t=a[e],n=k(t);n>s&&(o=t,s=n)}return O(o)||a.find(e=>k(e)>=0)||o}function P(e,t,n,r=``){if(e.source===`liepin`)return N(t,n,r);if(e.source===`boss`){let e=A([n,r,w(document,[`.location-address`,`.job-location .location-address`,`.job-location`,`.job-location-text`,`.job-area`,`.job-area-wrapper`,`.job-card-footer .job-area`]),...M(document),O(document.title||``)]);if(e.length===0)return``;let t=e[0],i=k(t);for(let n=1;n<e.length;n+=1){let r=e[n],a=k(r);a>i&&(t=r,i=a)}return O(t)||e.map(e=>O(e)).find(Boolean)||D(t)}return D(n)||D(r)}function F(e){if(!e)return``;let t=e.replace(/<br\s*\/?\s*>/gi,`
`).replace(/<\/p>/gi,`
`).replace(/<\/div>/gi,`
`).replace(/<[^>]+>/g,` `).replace(/&nbsp;/gi,` `),n=document.createElement(`textarea`);return n.innerHTML=t,(n.value||t).split(/\n+/).map(e=>i(e)).filter(Boolean).join(`
`).trim()}function I(e){let t=F(e);if(!t)return-999;let n=0,r=t.length,i=t.split(/\n+/).filter(Boolean).length;return r>=100&&(n+=3),r>=220&&(n+=4),r>=500&&(n+=3),r<70&&(n-=7),r>12e3&&(n-=5),i>=4&&(n+=2),St.test(t)&&(n+=7),Ct.test(t)&&r<260&&(n-=5),n}function L(e){let t=new Set,n=[];for(let r of e){let e=F(r);!e||t.has(e)||(t.add(e),n.push(e))}return n}function R(e,t,n=0){if(!e||t.length>80||n>8)return;if(Array.isArray(e)){for(let r of e)if(R(r,t,n+1),t.length>80)return;return}if(typeof e!=`object`)return;let r=e;for(let e of[`description`,`descriptionText`,`postDescription`,`jobDescription`,`jobContent`,`responsibility`,`requirement`,`Responsibilities`,`Requirement`]){let n=r[e];if(typeof n==`string`&&(t.push(n),t.length>80))return}for(let e of Object.values(r))if(!(!e||typeof e!=`object`)&&(R(e,t,n+1),t.length>80))return}function ne(e){let t=Array.from(e.querySelectorAll(`script[type='application/ld+json'], script[type='application/json'], script#__NEXT_DATA__, script#__NUXT_DATA__`));if(t.length===0)return[];let n=[];for(let e of t){let t=e.textContent?.trim();if(t&&!(t.length>bt))try{R(JSON.parse(t),n)}catch{continue}}return L(n)}function re(e){return L(Array.from(e.querySelectorAll(`meta[name='description'], meta[property='og:description'], meta[name='twitter:description']`)).map(e=>e.content||``).filter(Boolean))}function z(e){if(!e)return``;try{return JSON.parse(`"${e}"`)}catch{return e.replace(/\\n/g,`
`).replace(/\\r/g,`
`).replace(/\\t/g,`	`).replace(/\\"/g,`"`).replace(/\\\\/g,`\\`)}}function ie(e){let t=Array.from(e.querySelectorAll(`script:not([src])`));if(t.length===0)return[];let n=[],r=[/"(?:postDescription|descriptionText|jobDescription|jobContent|responsibility|requirement|Responsibilities|Requirement)"\s*:\s*"((?:\\.|[^"\\]){40,50000})"/g,/"description"\s*:\s*"((?:\\.|[^"\\]){120,50000})"/g];for(let e of t){let t=e.textContent?.trim()||``;if(t&&!(t.length>bt)&&/(postDescription|descriptionText|jobDescription|jobContent|responsibilit|requirement|description)/i.test(t)){for(let e of r){let r;for(;(r=e.exec(t))!==null;){let e=z(r[1]||``);if(e&&n.push(e),n.length>80)break}if(e.lastIndex=0,n.length>80)break}if(n.length>80)break}}return L(n)}function ae(e,t){let n=[];for(let r of t)e.querySelectorAll(r).forEach(e=>{let t=F(e.innerText||e.textContent||``);t&&n.push(t)});return L(n)}function oe(e){let t=L(e);if(t.length===0)return null;let n=t[0],r=I(n);for(let e=1;e<t.length;e+=1){let i=t[e],a=I(i);(a>r||a===r&&i.length>n.length)&&(n=i,r=a)}return{text:n,score:r}}function se(e,t){let n=ae(e,t.detailDescription),r=oe(n);if(r&&r.score>=0)return r.text;let i=[];i.push(...n),i.push(...ae(e,At)),i.push(...ne(e)),i.push(...ie(e)),i.push(...re(e));let a=oe(i);return a?a.score<0?[...L(i)].sort((e,t)=>t.length-e.length)[0]||``:a.text:``}function ce(e){return se(document,e)}function le(e){if(!e)return``;let t=i(e).replace(/[，,]/g,``).replace(/[：:]/g,``).replace(/\s+/g,``);if(!t)return``;if(/面议/.test(t))return`面议`;let n=t.match(/(\d+(?:\.\d+)?\s*(?:-|~|至)\s*\d+(?:\.\d+)?\s*(?:k|K|千|万|元\/天|元\/月|元\/小时|元\/时)(?:[·•]\d+\s*薪)?|面议)/i)||t.match(wt);if(!n){let e=t.match(/(\d+(?:\.\d+)?(?:-|~|至)\d+(?:\.\d+)?[^\s，。,；;]{0,8})/i);return e?(e[1]||``).replace(/至/g,`-`).trim():``}return(n[1]||``).replace(/至/g,`-`).replace(/\s+/g,``).trim()}function ue(e,t){let n=[e];n.push(...T(t,[`.info-primary .salary`,`.job-salary`,`.salary`,`.job-card-left .salary`,`.job-card-body .salary`,`.job-banner .salary`,`[class*='salary']`]));for(let e of n){let t=le(e);if(t)return t}if(t instanceof Element||t instanceof Document){let e=le(i(t.textContent||``));if(e)return e}return i(e)}function de(e){let t=F(e);if(!t)return``;let n=t.replace(Ot,` `).replace(/\n{3,}/g,`

`).trim(),r=n.search(Tt);r>0&&n.length-r>120&&(n=n.slice(r));let i=n.search(Et);i>120&&(n=n.slice(0,i));let a=n.split(/\n+/).map(e=>e.trim()).filter(Boolean).filter(e=>!Dt.test(e)).join(`
`).replace(/\n{3,}/g,`

`).trim(),o=a||n,s=Tt.test(o)||St.test(o),c=o.match(/(对搜索结果是否满意|热门职位|热门城市|热门企业|附近城市|企业服务热线|没有更多职位|立即登录|协议与规则|隐私政策|朝阳网警|京ICP备)/g)?.length||0;return s&&a.length>=60?a:s&&o.length>=80||c===0&&o.length>=260?o:``}function B(e){return e?i(e).replace(/(?:^发布时间[:：]?|^更新时间[:：]?|^发布于[:：]?|^更新于[:：]?)/i,``).replace(/^(?:发布|更新)[:：\s]+/i,``).replace(/\s+/g,` `).trim():``}function V(e){let t=new Set,n=[];for(let r of e){let e=B(r);!e||t.has(e)||(t.add(e),n.push(e))}return n}function H(e){if(typeof e==`string`)return e;if(typeof e==`number`&&Number.isFinite(e)){let t=Math.abs(e),n=t>0xe8d4a51000?e:t>1e9?e*1e3:NaN;if(Number.isFinite(n)){let e=new Date(n);if(!Number.isNaN(e.getTime()))return e.toISOString()}return String(e)}return``}function U(e,t,n=0){if(!e||t.length>60||n>8)return;if(Array.isArray(e)){for(let r of e)if(U(r,t,n+1),t.length>60)return;return}if(typeof e!=`object`)return;let r=e;for(let e of[`datePosted`,`pubDate`,`publishedAt`,`publishTime`,`publishDate`,`postedAt`,`upDate`,`updateTime`,`updatedAt`]){let n=H(r[e]);if(n&&(t.push(n),t.length>60))return}for(let e of Object.values(r))if(!(!e||typeof e!=`object`)&&(U(e,t,n+1),t.length>60))return}function fe(e){let t=Array.from(e.querySelectorAll(`script[type='application/ld+json']`));if(t.length===0)return[];let n=[];for(let e of t){let t=e.textContent?.trim();if(t&&!(t.length>bt)&&Nt.test(t))try{if(U(JSON.parse(t),n),n.length>60)break}catch{continue}}return V(n)}function pe(e){let t=Array.from(e.querySelectorAll(`script:not([src])`));if(t.length===0)return[];let n=[],r=/"(?:datePosted|pubDate|publishedAt|publishTime|publishDate|postedAt|upDate|updateTime|updatedAt)"\s*:\s*"((?:\\.|[^"\\]){4,120})"/g,i=/"(?:datePosted|pubDate|publishedAt|publishTime|publishDate|postedAt|upDate|updateTime|updatedAt)"\s*:\s*(\d{10,13})/g;for(let e of t){let t=e.textContent?.trim()||``;if(!t||t.length>12e5||!Nt.test(t))continue;let a;for(;(a=r.exec(t))!==null;){let e=z(a[1]||``);if(e&&n.push(e),n.length>60)break}if(r.lastIndex=0,n.length>60)break;let o;for(;(o=i.exec(t))!==null;){let e=H(Number(o[1]||``));if(e&&n.push(e),n.length>60)break}if(i.lastIndex=0,n.length>60)break}return V(n)}function W(e){return V(Array.from(e.querySelectorAll(`meta[property='article:published_time'], meta[property='article:modified_time'], meta[name='publishdate'], meta[name='pubdate'], meta[name='date'], meta[itemprop='datePosted']`)).map(e=>e.content||``).filter(Boolean))}function me(e){let t=B(e);if(!t)return-999;let n=0;return/20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?/.test(t)&&(n+=8),/20\d{2}-\d{1,2}-\d{1,2}T\d{1,2}/.test(t)&&(n+=9),/\d{1,2}月\d{1,2}日/.test(t)&&(n+=5),/发布时间|发布于|更新时间|更新于|更新|发布/.test(t)&&(n+=2),t.length>=6&&t.length<=40&&(n+=1),t.length>48&&(n-=6),Pt.test(t)&&(n-=5),n}function he(e){let t=V(e);if(t.length===0)return null;let n=t[0],r=me(n);for(let e=1;e<t.length;e+=1){let i=t[e],a=me(i);(a>r||a===r&&i.length<n.length)&&(n=i,r=a)}return{text:n,score:r}}function ge(e,t){let n=T(t,e.detailPostedAt),r=he(n);if(r&&r.score>=5)return r.text;let i=[...n,...W(t),...fe(t)],a=he(i);if(a&&a.score>=3)return a.text;let o=he([...i,...pe(t)]);return!o||o.score<0?``:o.text}function _e(e){return ge(e,document)}function ve(e,t){return JSON.stringify({pageType:e,source:t,hostname:window.location.hostname,path:window.location.pathname,capturedAt:new Date().toISOString()})}function G(e){return i(e).replace(/\s*-\s*智联招聘.*$/i,``).replace(/\s*招聘\s*$/i,``).replace(/^【\s*([^】]+)\s*】\s*/u,`$1 `).trim()}function K(e){let t=i(e);if(!t)return``;let n=t.match(/^(.{2,42}?)招聘/u);return n?i(n[1]):``}function q(){let e=``,t=``,n=i(document.title||``);if(n){let r=n.split(`_`);r.length>=2?(e=G(r[0]||``),t=i((r[1]||``).replace(/\s*招聘\s*-\s*智联招聘.*$/i,``).replace(/\s*招聘\s*$/i,``))):e=G(n)}let r=Array.from(document.querySelectorAll(`script[type='application/ld+json']`));for(let n of r){let r=n.textContent||``;if(r){if(!e){let t=r.match(/"title"\s*:\s*"((?:\\.|[^"\\]){2,220})"/);t&&(e=G(z(t[1]||``)))}if(!t){let e=r.match(/"description"\s*:\s*"((?:\\.|[^"\\]){8,800})"/);e&&(t=K(z(e[1]||``)))}if(e&&t)break}}return{title:e,company:t}}function J(){let e=window.location.hostname;return Je.find(t=>t.hostPattern.test(e))||null}function ye(e){if(e.detailPathHint&&e.detailPathHint.test(window.location.pathname))return!0;let t=!!w(document,e.detailDescription),n=!!w(document,e.detailTitle);return t&&n}function be(e){return document.querySelectorAll(e.listCard).length>0}function Y(e,t){let n=w(e,t.listTitle),r=w(e,t.listCompany);if(!n||!r)return null;let i=w(e,t.listSalary),c=t.source===`boss`?ue(i,e):i,{min:l,max:u}=o(c),d=P(t,`list`,w(e,t.listLocation)),f=a(ee(e,t.listLink),window.location.href),p=T(e,t.listTags),m=T(e,t.listCompanyTags);return{title:n,company:r,location:d,salary_text:c,salary_min:l,salary_max:u,raw_description:``,url:f,apply_url:f,source:t.source,source_page_meta:ve(`list`,t.source),education:E(p,/本科|硕士|博士|大专|学历|degree/i),experience:E(p,/经验|应届|实习|年|experience/i),job_type:E(p,/全职|实习|校招|兼职|full|intern/i),company_size:E(m,/人|employees|employee/i),company_industry:m.find(e=>!/人|employees|employee/i.test(e))||``,hash_key:s(t.source,n,r,f),status:`draft_pending_jd`,created_at:new Date().toISOString()}}function xe(e){let t=w(document,e.detailTitle)||w(document,e.listTitle),n=w(document,e.detailCompany)||w(document,e.listCompany),r=e.source===`boss`&&kt.test(window.location.pathname),i=null;if(r){let r=Te(e)||we(e);i=r?Y(r,e):null,i&&(t=i.title||t,n=i.company||n)}if(e.source===`zhaopin`&&(!t||!n)){let e=q();t||=e.title,n||=e.company}if(e.source===`boss`&&(!t||!n)){let r=Te(e)||we(e),i=r?Y(r,e):null;t=t||i?.title||``,n=n||i?.company||``}if(!t||!n)return null;let c=w(document,e.detailSalary)||i?.salary_text||w(document,e.listSalary),l=C(document,[`.job-detail-box`,`.job-card-body`,`.job-detail`,`.job-detail-section`])||document,u=e.source===`boss`?ue(c,l):c,{min:d,max:f}=o(u),p=P(e,`detail`,w(document,e.detailLocation),i?.location||w(document,e.listLocation)),m=ce(e),h=e.source===`boss`?de(m):m,g=T(document,e.detailTags),_=T(document,e.detailCompanyTags),v=_e(e),y=i?.url||a(window.location.href,window.location.href),b=a(ee(document,e.detailApplyLink)||i?.apply_url||y,window.location.href);return{title:t,company:n,location:p,salary_text:u,salary_min:d,salary_max:f,raw_description:h,posted_at:v||null,url:y,apply_url:b,source:e.source,source_page_meta:ve(`detail`,e.source),education:E(g,/本科|硕士|博士|大专|学历|degree/i),experience:E(g,/经验|应届|实习|年|experience/i),job_type:E(g,/全职|实习|校招|兼职|full|intern/i),company_size:E(_,/人|employees|employee/i),company_industry:_.find(e=>!/人|employees|employee/i.test(e))||``,hash_key:s(e.source,t,n,y),status:h?`ready_to_sync`:`draft_pending_jd`,created_at:new Date().toISOString()}}function Se(e,t){if(e.source!==`boss`)return t;let n=t.closest(`li.job-card-box, li.job-card-wrap, .job-list li, .rec-job-list li`);if(n)return n;let r=t.closest(`.job-card-box, .job-card-wrap`);return r?r.closest(`li`)||r:t}function Ce(e){let t=Array.from(document.querySelectorAll(e.listCard)),n=[],r=new Set;for(let i of t){let t=Se(e,i);r.has(t)||(r.add(t),n.push(t))}return n}function we(e){let t=Ce(e);return t.length===0?null:t.find(e=>{let t=e.getBoundingClientRect();return t.width>0&&t.height>0&&t.bottom>=0&&t.top<=window.innerHeight})||t[0]||null}function Te(e){if(e.source!==`boss`)return null;let t=document.querySelector(`.rec-job-list .job-card-wrap.active`)||document.querySelector(`.job-card-wrap.active`)||document.querySelector(`li.job-card-box.active`)||document.querySelector(`.job-card-box.active`);return t?t.closest(e.listCard)||t:null}function Ee(e){if(e.source===`boss`){let t=xe(e);if(t?.raw_description?.trim())return t}if(ye(e)){let t=xe(e);if(t)return t}let t=Te(e)||we(e);return t?Y(t,e):null}async function De(e,t){if(t.source!==`boss`||e.status!==`draft_pending_jd`)return e;let n=a(e.apply_url||e.url,window.location.href);if(!n||!/job_detail/i.test(n))return e;try{let r=await fetch(n,{method:`GET`,credentials:`include`,cache:`no-store`});if(!r.ok)return e;let i=await r.text();if(!i||i.length<200)return e;let a=new DOMParser().parseFromString(i,`text/html`),s=de(se(a,t));if(!s)return e;let c=ue(w(a,t.detailSalary)||w(a,t.listSalary),a),{min:l,max:u}=o(c||e.salary_text),d=ge(t,a);return{...e,salary_text:c||e.salary_text,salary_min:l,salary_max:u,raw_description:s,posted_at:d||e.posted_at||null,status:`ready_to_sync`}}catch{return e}}async function Oe(e,t){return await De(e,t)}function ke(e,t){if(!e){t({ok:!1,message:`当前页面暂不支持采集，请前往招聘站页面`,added:0,upgraded:0,skipped:0});return}let n=Ee(e);if(!n){t({ok:!1,message:be(e)?at:`未识别到可加入岗位，请在岗位详情页或岗位列表卡片上操作`,added:0,upgraded:0,skipped:0});return}(async()=>{let r=await Oe(n,e);Be([r],e=>{if(!e){t({ok:!1,message:`加入失败，请稍后重试`,added:0,upgraded:0,skipped:0});return}t({ok:!0,message:e.added>0?`已加入：${r.title}`:e.upgraded>0?`已补全JD：${r.title}`:`岗位已在购物车`,added:e.added,upgraded:e.upgraded,skipped:e.skipped})})})()}function X(e,t=!1){let n=document.getElementById(Ye);n&&n.remove();let r=document.createElement(`div`);r.id=Ye,r.textContent=e,r.style.position=`fixed`,r.style.top=`16px`,r.style.right=`16px`,r.style.zIndex=`2147483647`,r.style.padding=`10px 14px`,r.style.borderRadius=`8px`,r.style.background=t?`#b91c1c`:`#0f172a`,r.style.color=`#f8fafc`,r.style.fontSize=`13px`,r.style.boxShadow=`0 8px 20px rgba(0,0,0,0.25)`,r.style.maxWidth=`340px`,document.body.appendChild(r),window.setTimeout(()=>r.remove(),2e3)}function Ae(e){let t=new URLSearchParams({tab:e,embed:`drawer`});return chrome.runtime.getURL(`popup.html?${t.toString()}`)}function je(){if(Mt)return Mt;let e=document.getElementById(tt);e&&e.remove();let t=document.createElement(`div`);t.id=tt,t.style.setProperty(`position`,`fixed`,`important`),t.style.setProperty(`inset`,`0`,`important`),t.style.setProperty(`z-index`,`2147483647`,`important`),t.style.setProperty(`pointer-events`,`none`,`important`),t.style.setProperty(`display`,`block`,`important`),t.style.setProperty(`visibility`,`visible`,`important`),t.style.setProperty(`opacity`,`1`,`important`),t.style.setProperty(`isolation`,`isolate`,`important`);let n=t.attachShadow({mode:`open`}),r=document.createElement(`style`);r.textContent=`
    .drawer-shell {
      position: fixed;
      inset: 0;
      pointer-events: none;
    }
    .drawer-panel {
      position: absolute;
      width: min(392px, calc(100vw - 12px));
      height: min(566px, calc(100vh - 12px));
      background: #f7f8fc;
      box-shadow: 0 18px 38px rgba(2, 6, 23, 0.28);
      --drawer-x: 0px;
      --drawer-y: 0px;
      --drawer-scale: 0.97;
      transform: translate3d(var(--drawer-x), var(--drawer-y), 0) scale(var(--drawer-scale));
      transform-origin: top left;
      transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.18s ease;
      border-radius: 12px;
      display: none;
      grid-template-rows: minmax(0, 1fr);
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
    }
    .drawer-shell.is-visible .drawer-panel {
      display: grid;
      pointer-events: auto;
    }
    .drawer-frame {
      width: 100%;
      height: 100%;
      border: 0;
      background: #f4f6fb;
      pointer-events: auto;
    }
    .drawer-shell.is-open .drawer-panel {
      opacity: 1;
      --drawer-scale: 1;
    }
    .drawer-shell.is-dragging .drawer-panel {
      transition: opacity 0.18s ease;
    }
  `;let i=document.createElement(`div`);i.className=`drawer-shell`,i.innerHTML=`
    <aside class="drawer-panel" role="dialog" aria-label="OfferU 功能弹窗" aria-modal="false">
      <iframe class="drawer-frame" title="OfferU Drawer" loading="eager" allow="clipboard-write"></iframe>
    </aside>
  `;let a=i.querySelector(`iframe`),o=i.querySelector(`.drawer-panel`),s=!1,c=0,l=0,u=0,d=0,f=0,p=0,m=0,h=0,g=0,_=!1,v=0;function y(){return{width:Math.max(280,Math.min(392,window.innerWidth-12)),height:Math.max(360,Math.min(566,window.innerHeight-12))}}function b(e,t){let n=y(),r=Math.max(10,window.innerWidth-n.width-10),i=Math.max(10,window.innerHeight-n.height-10);return{left:Math.max(10,Math.min(e,r)),top:Math.max(10,Math.min(t,i))}}function x(e=c,t=l){let n=b(e,t);c=n.left,l=n.top,o.style.setProperty(`--drawer-x`,`${c}px`),o.style.setProperty(`--drawer-y`,`${l}px`)}function S(){let e=y();x(window.innerWidth-e.width-10,Math.round((window.innerHeight-e.height)/2))}function C(){let e=o.getBoundingClientRect(),t=e.width<120||e.height<120,n=e.right<10||e.left>window.innerWidth-10||e.bottom<10||e.top>window.innerHeight-10;(t||n)&&S()}function w(){g&&=(window.cancelAnimationFrame(g),0),_=!1,i.classList.remove(`is-dragging`)}function T(){g=0,x(m,h)}function ee(e,t){s&&(_=!0,u=e,d=t,f=c,p=l,m=c,h=l,i.classList.add(`is-dragging`))}function E(e,t){_&&(m=f+(e-u),h=p+(t-d),g||=window.requestAnimationFrame(T))}function D(e,t){_&&(typeof e==`number`&&typeof t==`number`&&(m=f+(e-u),h=p+(t-d),g&&=(window.cancelAnimationFrame(g),0),x(m,h)),w())}let O=()=>{!s&&!i.classList.contains(`is-visible`)||(s=!1,D(),i.classList.remove(`is-open`),v&&=(window.clearTimeout(v),0),v=window.setTimeout(()=>{s||i.classList.remove(`is-visible`)},190))},k=e=>{let t=Ae(e);a.getAttribute(`src`)!==t&&a.setAttribute(`src`,t),v&&=(window.clearTimeout(v),0),i.classList.add(`is-visible`),s?x(c,l):S(),s=!0,window.requestAnimationFrame(()=>{s&&(i.classList.add(`is-open`),C())})};return window.addEventListener(`message`,e=>{if(!s||e.source!==a.contentWindow)return;let t=e.data,n=typeof t?.screenX==`number`?t.screenX:t?.clientX,r=typeof t?.screenY==`number`?t.screenY:t?.clientY;if(t?.type===`offeru:drawer-focus-request`){try{window.focus()}catch{}try{a.focus()}catch{}a.contentWindow?.postMessage({type:`offeru:drawer-focus-ack`,requestId:t.requestId},`*`);return}if(t?.type===`offeru:drawer-close`){t.reason===it&&O();return}if(t?.type===`offeru:drawer-drag-start`){typeof n==`number`&&typeof r==`number`&&ee(n,r);return}if(t?.type===`offeru:drawer-drag-move`){typeof n==`number`&&typeof r==`number`&&E(n,r);return}t?.type===`offeru:drawer-drag-end`&&D(n,r)}),window.addEventListener(`resize`,()=>{s&&x(c,l)}),document.addEventListener(`keydown`,e=>{s&&e.key===`Escape`&&O()},!0),n.appendChild(r),n.appendChild(i),(document.body||document.documentElement).appendChild(t),Mt={open:k,close:O,toggle:(e=`cart`)=>{if(s){O();return}k(e)},isOpen:()=>s},Mt}function Me(e){try{je().open(e)}catch{chrome.runtime.sendMessage({type:`OPEN_DRAWER`,tab:e},e=>{(chrome.runtime.lastError||!e?.ok)&&X(`打开抽屉失败，请重试`,!0)})}}function Ne(e=`cart`){try{je().toggle(e)}catch{Me(e)}}function Pe(e){chrome.runtime.sendMessage({type:`SYNC_TO_SERVER`},t=>{if(chrome.runtime.lastError){X(`同步失败，请稍后重试`,!0),e?.();return}t?.ok?X(`已同步 ${t.synced} 条岗位`):X(t?.error||`同步失败`,!0),e?.()})}function Fe(e){let t=e.trim().toLowerCase();return t===` `?`Space`:t===`escape`?`Esc`:t===`arrowup`?`Up`:t===`arrowdown`?`Down`:t===`arrowleft`?`Left`:t===`arrowright`?`Right`:t.length===1||/^f\d{1,2}$/.test(t)?t.toUpperCase():e.trim()}function Z(e){if(!e)return``;let t=e.split(`+`).map(e=>e.trim()).filter(Boolean),n=new Set,r=``;for(let e of t){let t=e.toLowerCase();if(t===`ctrl`||t===`control`){n.add(`Ctrl`);continue}if(t===`alt`||t===`option`){n.add(`Alt`);continue}if(t===`shift`){n.add(`Shift`);continue}if(t===`meta`||t===`cmd`||t===`command`){n.add(`Meta`);continue}r=Fe(e)}if(!r)return``;let i=[];return n.has(`Ctrl`)&&i.push(`Ctrl`),n.has(`Alt`)&&i.push(`Alt`),n.has(`Shift`)&&i.push(`Shift`),n.has(`Meta`)&&i.push(`Meta`),i.push(r),i.join(`+`)}function Ie(e){if([`Control`,`Shift`,`Alt`,`Meta`].includes(e.key))return``;let t=[];return e.ctrlKey&&t.push(`Ctrl`),e.altKey&&t.push(`Alt`),e.shiftKey&&t.push(`Shift`),e.metaKey&&t.push(`Meta`),t.push(Fe(e.key)),Z(t.join(`+`))}function Le(e){if(!(e instanceof HTMLElement))return!1;if(e.isContentEditable)return!0;let t=e.tagName;return t===`INPUT`||t===`TEXTAREA`||t===`SELECT`}function Re(e){if(document.getElementById(Qe))return;let t=document.createElement(`div`);t.id=Qe,t.style.position=`fixed`,t.style.zIndex=`2147483645`,t.style.top=`${Math.round(window.innerHeight*.38)}px`,t.style.right=`0px`,t.style.left=`auto`;let n=`cubic-bezier(0.22, 1, 0.36, 1)`,r=`transform 0.22s ${n}, top 0.18s ${n}, left 0.18s ${n}, right 0.18s ${n}`;t.style.transition=r,t.style.willChange=`transform`;let i=t.attachShadow({mode:`open`}),a=document.createElement(`style`);a.textContent=`
    .dock {
      font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      position: relative;
      width: fit-content;
      --motion: cubic-bezier(0.22, 1, 0.36, 1);
    }
    .compact {
      all: initial;
      font-family: inherit;
      border: 1px solid #dbe2ea;
      border-radius: 999px;
      background: #fffffff2;
      color: #111827;
      width: ${ct}px;
      height: ${lt}px;
      padding: 0 12px;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: width 0.22s var(--motion), height 0.22s var(--motion), padding 0.22s var(--motion), border-radius 0.22s var(--motion), box-shadow 0.22s var(--motion), background 0.22s var(--motion), backdrop-filter 0.22s var(--motion), opacity 0.18s var(--motion);
    }
    .dock.is-muted .compact {
      filter: grayscale(0.92);
      opacity: 0.64;
    }
    .compact:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }
    .compact-inner {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .compact-main {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .brand {
      font-size: 16px;
      font-weight: 700;
      color: #0057be;
      line-height: 1;
    }
    .badge {
      min-width: 17px;
      height: 17px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #e53935;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 0 4px;
      line-height: 1;
    }
    .compact-actions {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .mini-btn {
      all: initial;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: transparent;
      border: none;
    }
    .mini-btn:hover {
      opacity: 0.72;
    }
    .mini-icon {
      font-size: 10px;
      line-height: 1;
      color: #1b1b1e;
    }
    .mini-icon-arrow {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .mini-icon-chevron {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: transform 0.18s var(--motion);
    }
    .mini-icon-chevron.is-open {
      transform: rotate(180deg);
    }
    .panel {
      position: absolute;
      top: calc(100% + 6px);
      width: ${ft}px;
      min-height: ${pt}px;
      border: 1px solid #ffffff;
      border-radius: 20px;
      background: #ffffffe6;
      backdrop-filter: blur(10px);
      box-shadow: 0 12px 28px rgba(2, 6, 23, 0.14);
      padding: 10px;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translateY(-10px) scale(0.94);
      transition: opacity 0.22s var(--motion), transform 0.22s var(--motion), visibility 0.22s linear;
    }
    .panel.show {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    .actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .action-btn {
      all: initial;
      font-family: inherit;
      border-radius: 16px;
      height: 44px;
      padding: 0 10px;
      font-size: 12px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: 1px solid transparent;
      background: #f2eff4;
      color: #374151;
      line-height: 1;
    }
    .action-btn.primary {
      background: linear-gradient(135deg, #0f66e9, #1f88ff);
      border-color: #0f66e9;
      color: #ffffff;
    }
    .meta {
      margin-top: 8px;
      font-size: 11px;
      color: #6b7280;
      text-align: left;
      line-height: 1.3;
    }
    .meta.meta-secondary {
      margin-top: 4px;
      color: #4b5563;
    }
    .meta.meta-secondary.ok {
      color: #15803d;
    }
    .meta.meta-secondary.warn {
      color: #b45309;
    }
    .dock.theme-dark .compact {
      border-color: #3f3f46;
      background: #27272a;
      color: #f9fafb;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4);
    }
    .dock.theme-dark .brand {
      color: #006fee;
    }
    .dock.theme-dark .mini-btn {
      background: transparent;
      border: none;
    }
    .dock.theme-dark .mini-btn:hover {
      opacity: 0.72;
    }
    .dock.theme-dark .mini-icon {
      color: #a1a1aa;
    }
    .dock.theme-dark .panel {
      border-color: #3f3f46;
      background: #27272a;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
    }
    .dock.theme-dark .action-btn {
      border-color: transparent;
      background: #3f3f46;
      color: #e5e7eb;
    }
    .dock.theme-dark .action-btn.primary {
      background: linear-gradient(135deg, #1d4ed8, #2563eb);
      border-color: #2563eb;
      color: #ffffff;
    }
    .dock.theme-dark .meta {
      color: #9ca3af;
    }
    .dock.theme-dark .meta.meta-secondary {
      color: #9ca3af;
    }
    .dock.theme-dark .meta.meta-secondary.ok {
      color: #4ade80;
    }
    .dock.theme-dark .meta.meta-secondary.warn {
      color: #fbbf24;
    }
    .dock.mode-edge .compact {
      padding: 0 10px;
      background: #ffffff;
      border-color: #ffffff;
      box-shadow: 0 6px 14px rgba(2, 6, 23, 0.14);
      opacity: 1;
    }
    .dock.mode-edge.side-left .compact,
    .dock.mode-edge.side-right .compact {
      width: ${ht}px;
      min-width: ${ht}px;
      max-width: ${ht}px;
      height: ${Q}px;
      min-height: ${Q}px;
      max-height: ${Q}px;
    }
    .dock.mode-edge.side-top .compact,
    .dock.mode-edge.side-bottom .compact {
      width: ${gt}px;
      min-width: ${gt}px;
      max-width: ${gt}px;
      height: ${$}px;
      min-height: ${$}px;
      max-height: ${$}px;
    }
    .dock.mode-edge.side-right .compact {
      border-radius: 999px 0 0 999px;
      border-right: 0;
    }
    .dock.mode-edge.side-left .compact {
      border-radius: 0 999px 999px 0;
      border-left: 0;
    }
    .dock.mode-edge.side-top .compact {
      border-radius: 0 0 ${_t}px ${_t}px;
      border-top: 0;
    }
    .dock.mode-edge.side-bottom .compact {
      border-radius: ${_t}px ${_t}px 0 0;
      border-bottom: 0;
    }
    .dock.mode-edge .compact-main {
      width: 100%;
      justify-content: center;
    }
    .dock.mode-edge .badge,
    .dock.mode-edge .compact-actions {
      display: none;
    }
    .dock.mode-edge .brand {
      font-size: 16px;
      color: #0057be;
    }
    .dock.mode-edge:hover .compact,
    .dock.mode-edge.mode-dragging .compact {
      opacity: 1;
    }
    .dock.theme-dark.mode-edge .compact {
      background: #1f1f23;
      border-color: #3f3f46;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.42);
    }
    .dock.theme-dark.mode-edge .brand {
      color: #006fee;
    }
    .dock.mode-edge.side-left .compact-inner,
    .dock.mode-edge.side-right .compact-inner,
    .dock.mode-edge.side-top .compact-inner,
    .dock.mode-edge.side-bottom .compact-inner {
      flex-direction: row;
    }
    .dock.side-left .compact-inner {
      flex-direction: row-reverse;
    }
    .dock.side-left .compact-actions {
      margin-left: 0;
      margin-right: auto;
    }
    .dock.side-right .compact-inner {
      flex-direction: row;
    }
    .dock.side-right .compact-actions {
      margin-left: auto;
      margin-right: 0;
    }
    .dock.mode-expanded .compact {
      width: ${ut}px;
      height: ${dt}px;
      border-radius: 999px;
      box-shadow: 0 10px 22px rgba(15, 23, 42, 0.24);
    }
    .dock.mode-dragging .compact {
      cursor: grabbing;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.26);
    }
    .dock.side-left .panel {
      left: 0;
      right: auto;
      transform-origin: left top;
    }
    .dock.side-right .panel {
      right: 0;
      left: auto;
      transform-origin: right top;
    }
    .dock.side-top .panel,
    .dock.side-bottom .panel {
      left: 0;
      right: auto;
      transform-origin: left top;
    }
    .dock.side-bottom .panel {
      top: auto;
      bottom: calc(100% + 16px);
      transform-origin: left bottom;
      transform: translateY(10px) scale(0.94);
    }
  `;let o=document.createElement(`div`);o.className=`dock side-right`;let s=document.createElement(`div`);s.className=`compact`,s.setAttribute(`role`,`button`),s.setAttribute(`tabindex`,`0`),s.setAttribute(`aria-label`,`OfferU 悬浮入口`),s.setAttribute(`aria-expanded`,`false`),s.innerHTML=`
    <span class="compact-inner">
      <span class="compact-main">
        <span class="brand">OfferU</span>
        <span class="badge" id="offeruFloatingBadge">0</span>
      </span>
      <span class="compact-actions">
        <button class="mini-btn" type="button" data-action="open-drawer" aria-label="打开功能弹窗">
          <svg class="mini-icon mini-icon-arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 16L16 8" />
            <path d="M10 8H16V14" />
          </svg>
        </button>
        <button class="mini-btn" type="button" data-action="toggle-panel" aria-label="展开面板">
          <svg class="mini-icon mini-icon-chevron" id="offeruFloatingToggleGlyph" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9L12 15L18 9" />
          </svg>
        </button>
      </span>
    </span>
  `,o.appendChild(s),i.appendChild(a),i.appendChild(o);let c=i.querySelector(`#offeruFloatingBadge`),l=i.querySelector(`#offeruFloatingToggleGlyph`),u=null,d=null,f=null,p=null,m=`草稿 0 条 | 可同步 0 条`,h=`当前页面：检测中`,g=`warn`,_=!1,v=!1,y=`right`,b=!1,x=`system`,S={...st},C=window.matchMedia(`(prefers-color-scheme: dark)`),w=!1,T=null,ee=0,E=0,D=0,O=0,k=0,A=0,te=0,j=0,M=0,N=!1,P=!1,F=null;function I(e){let n=t.getBoundingClientRect(),r=v?y===`left`||y===`right`?Q:$:dt,i=Math.max(r,n.height||r),a=Math.max(6,window.innerHeight-i-6);return Math.max(6,Math.min(e,a))}function L(e){let n=t.getBoundingClientRect(),r=v?y===`left`||y===`right`?ht:gt:ut,i=Math.max(r,n.width||r),a=Math.max(0,window.innerWidth-i);return Math.max(0,Math.min(e,a))}function R(){let e=Number.parseFloat(t.style.top||`0`);return Number.isFinite(e)?e:8}function ne(){let e=Number.parseFloat(t.style.left||``);return Number.isFinite(e)?e:t.getBoundingClientRect().left}function re(){return window.innerWidth-(ut+yt)}function z(e){return e===`system`?C.matches?`dark`:`light`:e}function ie(){let e=z(x);o.classList.toggle(`theme-dark`,e===`dark`)}function ae(e){if(!e)return{text:`当前页面：暂不支持采集`,tone:`warn`};let t=Ee(e);return t?t.status===`ready_to_sync`||t.raw_description?.trim()?{text:`当前页面：可添加岗位（可同步）`,tone:`ok`}:{text:`当前页面：可添加岗位（需补全JD）`,tone:`ok`}:be(e)||ye(e)?{text:`当前页面：未识别到可添加岗位`,tone:`warn`}:{text:`当前页面：非岗位页`,tone:`warn`}}function oe(){f&&(f.textContent=m),p&&(p.textContent=h,p.classList.toggle(`ok`,g===`ok`),p.classList.toggle(`warn`,g===`warn`))}function se(t){if(t===`collect`){ke(J()||e,e=>{X(e.message,!e.ok),q()});return}t===`sync`&&Pe(()=>{q()})}function ce(){if(u)return oe(),u;let e=document.createElement(`div`);return e.className=`panel`,e.innerHTML=`
      <div class="actions">
        <button class="action-btn" data-action="collect" type="button">+ 加入</button>
        <button class="action-btn primary" data-action="sync" type="button">去同步</button>
      </div>
      <div class="meta" id="offeruFloatingMeta">${m}</div>
      <div class="meta meta-secondary" id="offeruFloatingCollectability">${h}</div>
    `,d=new AbortController,e.addEventListener(`click`,e=>{let t=e.target.closest(`button[data-action]`)?.dataset.action;t&&se(t)},{signal:d.signal}),o.appendChild(e),u=e,f=u.querySelector(`#offeruFloatingMeta`),p=u.querySelector(`#offeruFloatingCollectability`),oe(),e}function le(){u&&(d?.abort(),d=null,u.remove(),u=null,f=null,p=null)}function ue(){return`translate3d(0, 0, 0)`}function de(){let e=ue();if(j===0&&M===0){t.style.transform=e;return}t.style.transform=`${e} translate3d(${j}px, ${M}px, 0)`}function B(){let e=v&&!_&&!b&&!N,t=!b&&!_&&!N;o.classList.toggle(`mode-edge`,e),o.classList.toggle(`is-muted`,t),s.setAttribute(`aria-label`,e?`OfferU 贴边入口`:`OfferU 悬浮入口`),de()}function V(e){y=e,o.classList.toggle(`side-left`,y===`left`),o.classList.toggle(`side-right`,y===`right`),o.classList.toggle(`side-top`,y===`top`),o.classList.toggle(`side-bottom`,y===`bottom`)}function H(e,t=!0){_=e,o.classList.toggle(`mode-expanded`,_),_?(ce().classList.add(`show`),q()):(u?.classList.remove(`show`),le()),s.setAttribute(`aria-expanded`,_?`true`:`false`),l&&l.classList.toggle(`is-open`,_),B(),t&&ge()}function U(){let e=t.getBoundingClientRect();return{x:e.left,y:e.top}}function fe(e,n){let r=L(e),i=I(n);t.style.top=`${i}px`,t.style.left=`${r}px`,t.style.right=`auto`}function pe(e,n,r){if(v=!0,V(e),_&&H(!1,!1),e===`left`||e===`right`){t.style.top=`${I(r)}px`,t.style.left=e===`left`?`0px`:`auto`,t.style.right=e===`right`?`0px`:`auto`,B();return}t.style.left=`${L(n)}px`,t.style.right=`auto`;let i=e===`top`||e===`bottom`?$:Q;t.style.top=e===`top`?`0px`:`${Math.max(0,window.innerHeight-i)}px`,B()}function W(e,n){v=!1,t.style.top=`${I(n)}px`,t.style.left=`${L(e)}px`,t.style.right=`auto`,B()}function me(){let e=t.getBoundingClientRect(),n=[{side:`left`,gap:e.left},{side:`right`,gap:window.innerWidth-(e.left+e.width)},{side:`top`,gap:e.top},{side:`bottom`,gap:window.innerHeight-(e.top+e.height)}];n.sort((e,t)=>e.gap-t.gap);let r=n[0];r&&r.gap<=vt?pe(r.side,e.left,e.top):W(e.left,e.top),ge()}function he(){te=0,j=k,M=A,de()}function ge(){F!==null&&window.clearTimeout(F),F=window.setTimeout(()=>{F=null;let e={side:y,top:R(),expanded:!1,edgeDocked:v,left:ne()};chrome.storage.local.set({[$e]:e})},120)}async function _e(){let e=await new Promise(e=>{chrome.storage.local.get([$e],t=>{if(chrome.runtime.lastError){e(null);return}let n=t[$e];if(!n||typeof n!=`object`){e(null);return}e(n)})});if(!e){W(re(),Math.round(window.innerHeight*.38));return}(e.side===`left`||e.side===`right`||e.side===`top`||e.side===`bottom`)&&V(e.side),typeof e.top==`number`&&Number.isFinite(e.top)&&(t.style.top=`${I(e.top)}px`);let n=typeof e.top==`number`&&Number.isFinite(e.top)?e.top:Math.round(window.innerHeight*.38),r=typeof e.left==`number`&&Number.isFinite(e.left)?e.left:re();e.edgeDocked?pe(y,r,n):W(r,n),H(!1,!1)}function ve(){if(!w)return;window.removeEventListener(`pointermove`,G,!0),window.removeEventListener(`pointerup`,K,!0),window.removeEventListener(`pointercancel`,K,!0);let e=N;if(te&&=(window.cancelAnimationFrame(te),0),T!==null&&s.hasPointerCapture(T)&&s.releasePointerCapture(T),w=!1,T=null,N=!1,P=!1,t.style.transition=r,o.classList.remove(`mode-dragging`),e){let e=D+k,t=O+A;j=0,M=0,de(),fe(e,t),me();return}j=0,M=0,B()}function G(e){if(!w||e.pointerId!==T)return;let n=e.clientX-ee,r=e.clientY-E;if(k=n,A=r,!N&&(Math.abs(n)>4||Math.abs(r)>4)){if(N=!0,P){v=!1;let e=U();t.style.left=`${L(e.x)}px`,t.style.right=`auto`,P=!1}H(!1)}N&&(te||=window.requestAnimationFrame(he))}function K(e){e.pointerId===T&&ve()}async function q(){let t=ae(J()||e);h=t.text,g=t.tone;try{let e=await Ve({type:`GET_STATUS`});c&&(c.textContent=String(Math.max(0,e.total))),m=`草稿 ${Math.max(0,e.draft)} 条 | 可同步 ${Math.max(0,e.ready)} 条`}catch{m=`状态读取失败`}oe()}function Y(){chrome.storage.local.get([nt],e=>{let t=(e[nt]||{}).theme;x=t===`light`||t===`dark`||t===`system`?t:`system`,ie()})}function xe(){chrome.storage.local.get([rt],e=>{let t=e[rt]||{};S={collect:Z(t.collect||st.collect),sync:Z(t.sync||st.sync),settings:Z(t.settings||st.settings)}})}function Se(t){if(t===`collect`){ke(J()||e,e=>{X(e.message,!e.ok),q()});return}if(t===`sync`){Pe(()=>{q()});return}t===`settings`&&Ne(`cart`)}function Ce(e){if(Le(e.target))return;let t=Ie(e);if(!t)return;let n=Z(S.collect),r=Z(S.sync),i=Z(S.settings);if(t===n){e.preventDefault(),Se(`collect`);return}if(t===r){e.preventDefault(),Se(`sync`);return}t===i&&(e.preventDefault(),Se(`settings`))}C.addEventListener(`change`,()=>{x===`system`&&ie()}),chrome.storage.onChanged.addListener((e,t)=>{if(t===`local`){if(e[nt]){let t=e[nt].newValue?.theme;x=t===`light`||t===`dark`||t===`system`?t:`system`,ie()}e[rt]&&xe()}}),s.addEventListener(`pointerdown`,e=>{if(e.target.closest(`button[data-action]`)||e.button!==0)return;e.preventDefault(),w=!0,T=e.pointerId,N=!1,ee=e.clientX,E=e.clientY;let n=U();D=n.x,O=n.y,P=v,o.classList.add(`mode-dragging`),t.style.transition=`none`,s.setPointerCapture(e.pointerId),window.addEventListener(`pointermove`,G,!0),window.addEventListener(`pointerup`,K,!0),window.addEventListener(`pointercancel`,K,!0)}),s.addEventListener(`click`,e=>{let t=e.target.closest(`button[data-action]`)?.dataset.action;if(t){if(e.preventDefault(),e.stopPropagation(),t===`open-drawer`){Ne(`cart`);return}t===`toggle-panel`&&H(!_)}}),s.addEventListener(`lostpointercapture`,e=>{e.pointerId===T&&ve()}),o.addEventListener(`mouseenter`,()=>{b=!0,B(),q()}),o.addEventListener(`mouseleave`,()=>{b=!1,B()}),document.addEventListener(`pointerdown`,e=>{_&&((typeof e.composedPath==`function`?e.composedPath():[]).includes(t)||H(!1))},!0),window.addEventListener(`resize`,()=>{let e=R(),t=ne();if(v){pe(y,t,e);return}W(t,e)}),document.addEventListener(`keydown`,Ce,!0),document.body.appendChild(t),_e(),Y(),xe(),B(),q()}function ze(e){let t=document.createElement(`div`),n=t.attachShadow({mode:`open`}),r=document.createElement(`style`);r.textContent=`
    .offeru-btn {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 10px;
      border-radius: 8px;
      border: 0;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(37,99,235,0.24);
    }
    .offeru-btn[disabled] {
      opacity: 0.7;
      cursor: default;
      box-shadow: none;
    }
  `;let i=document.createElement(`button`);return i.className=`offeru-btn`,i.textContent=e,i.type=`button`,n.appendChild(r),n.appendChild(i),{host:t,button:i,setLabel(e){i.textContent=e},setBusy(e){i.disabled=e}}}function Be(e,t){chrome.runtime.sendMessage({type:`JOBS_COLLECTED`,jobs:e},e=>{if(chrome.runtime.lastError){t(null);return}t(e||null)})}function Ve(e){return new Promise((t,n)=>{chrome.runtime.sendMessage(e,e=>{if(chrome.runtime.lastError){n(Error(chrome.runtime.lastError.message));return}t(e)})})}function He(){Ft||=(chrome.runtime.onMessage.addListener((e,t,n)=>{if(e?.type===et)return ke(J(),e=>{n(e)}),!0}),!0)}function Ue(e){Ce(e).forEach(t=>{if(t.getAttribute(Ze)===`1`)return;let n=ze(`加入简历购物车`);n.host.setAttribute(ot,`1`),n.host.style.display=`inline-block`,n.host.style.marginTop=`8px`,n.button.addEventListener(`click`,r=>{r.preventDefault(),r.stopPropagation();let i=Y(t,e);if(!i){X(`当前卡片未识别到岗位信息，请刷新后重试`,!0);return}n.setBusy(!0),n.setLabel(`加入中...`),(async()=>{let t=await Oe(i,e);Be([t],e=>{if(n.setBusy(!1),!e){n.setLabel(`加入简历购物车`),X(`加入失败，请稍后重试`,!0);return}if(e.added>0){n.setLabel(t.status===`ready_to_sync`?`已加入可同步`:`已加入草稿`),X(`已加入：${t.title}`);return}if(e.upgraded>0){n.setLabel(`已补全并更新`),X(`已补全JD：${t.title}`);return}n.setLabel(`已在购物车`),X(`岗位已存在购物车`)})})()});let r=C(t,e.listActionTargets)||t.querySelector(`.job-info`)||t;r.querySelectorAll(`[${ot}='1']`).forEach(e=>{e.remove()}),Array.from(r.children).forEach(e=>{let t=e,n=t.shadowRoot?.querySelector(`button`)?.textContent||``;/加入简历购物车/.test(n)&&t.remove()}),r.appendChild(n.host),t.setAttribute(Ze,`1`)})}function We(e){if(document.getElementById(Xe))return;let t=ze(`加入简历购物车（详情）`);t.host.id=Xe,t.host.style.position=`fixed`,t.host.style.right=`20px`,t.host.style.bottom=`90px`,t.host.style.zIndex=`2147483646`,t.button.addEventListener(`click`,()=>{let n=xe(e);if(!n){X(`当前页面未识别到岗位详情信息`,!0);return}t.setBusy(!0),Be([n],e=>{if(t.setBusy(!1),!e){X(`采集失败，请稍后重试`,!0);return}if(e.added>0){t.setLabel(`已加入购物车`),X(`已加入：${n.title}`);return}if(e.upgraded>0){t.setLabel(`已补全并更新`),X(`已补全JD：${n.title}`);return}t.setLabel(`已在购物车`),X(`岗位已存在购物车`)})}),document.body.appendChild(t.host)}function Ge(){let e=J();Re(e),e&&(ye(e)&&We(e),be(e)&&Ue(e))}function Ke(){It!==null&&window.clearTimeout(It),It=window.setTimeout(()=>{Ge(),It=null},220)}function qe(){He(),Ge(),new MutationObserver(()=>{Ke()}).observe(document.body,{childList:!0,subtree:!0})}var Je,Ye,Xe,Ze,Qe,$e,et,tt,nt,rt,it,at,ot,st,ct,lt,ut,dt,ft,pt,mt,ht,Q,gt,$,_t,vt,yt,bt,xt,St,Ct,wt,Tt,Et,Dt,Ot,kt,At,jt,Mt,Nt,Pt,Ft,It,Lt=t((()=>{c(),b(),Je=y,Ye=`offeru-ext-toast`,Xe=`offeru-ext-detail-button`,Ze=`data-offeru-list-btn`,Qe=`offeru-ext-floating-dock`,$e=`offeru-ext-floating-dock-state-v1`,et=`OFFERU_TRIGGER_COLLECT`,tt=`offeru-ext-page-drawer`,nt=`popupUiSettings`,rt=`shortcutSettingsV1`,it=`close-button`,at=`当前列表未识别到岗位，请先点击目标岗位卡片后重试`,ot=`data-offeru-list-btn-host`,st={collect:`Alt+J`,sync:`Alt+S`,settings:`Alt+O`},ct=200,lt=44,ut=260,dt=50,ft=260,pt=114,mt=30,ht=Math.max(60,Math.round(ct/2)-mt),Q=lt,gt=Math.max(60,Math.round(ct/2)-mt),$=lt,_t=16,vt=56,yt=16,bt=8e6,xt=/(?:\d+\s*[-~]\s*\d+\s*[kK万]|面议|经验|应届|实习|本科|硕士|博士|大专|学历|招聘|发布|更新|招\d+人)/i,St=/(岗位职责|职位描述|工作内容|任职要求|职位要求|职责|你将负责|我们希望|Job Description|Responsibilities|Requirements|Qualifications|About the job|What you'll do)/i,Ct=/(登录|扫码|分享|举报|收藏|投诉|隐私政策|免责声明|版权所有|推荐企业|公司简介|公司信息|官方微信|立即登录|企业服务热线)/i,wt=/(\d+(?:\.\d+)?\s*(?:-|~|至)\s*\d+(?:\.\d+)?\s*(?:k|K|千|万)(?:[·•]\d+\s*薪)?|面议)/i,Tt=/(职位描述|岗位职责|工作职责|职位职责|工作内容|你将负责|任职要求|职位要求|任职资格|岗位要求|Job Description|Responsibilities|Requirements|Qualifications)/i,Et=/(竞争力分析|公司介绍|公司简介|工商信息|工作地址|职位发布者|去APP|下载APP|立即沟通|举报|分享|收藏|微信扫码|BOSS直聘安全提示|BOSS\s*安全提示|个人综合排名|请立即举报|违法和不良信息举报邮箱)/i,Dt=/(刚刚活跃|今日活跃|本周活跃|半年前活跃|近\d+(?:天|周|月)活跃|去APP与BOSS随时沟通|下载APP|前往APP|立即沟通|分享|举报|收藏|扫码登录|BOSS\s*安全提示|竞争力分析|对搜索结果是否满意|热门职位|热门城市|热门企业|附近城市|企业服务热线|老年人直连热线|工作日\s*8:00\s*-\s*22:00|休息日\s*8:00\s*-\s*22:00|没有更多职位|尝试登录查看全部职位|立即登录|协议与规则|隐私政策|防骗指南|使用帮助|朝阳网警|电子营业执照|京ICP备|算法备案信息|个人综合排名|在人中排名第|加载中|·HR|请立即举报|违法和不良信息举报邮箱|^(?:一般|良好|优秀|极好)$|^[\u4e00-\u9fa5]{1,4}(?:先生|女士)$)/i,Ot=/(去APP与BOSS随时沟通|前往APP查看|下载APP|立即沟通|分享|举报|收藏|刚刚活跃|今日活跃|本周活跃|微信扫码登录|竞争力分析|对搜索结果是否满意|热门职位|热门城市|热门企业|附近城市|没有更多职位|尝试登录查看全部职位|立即登录|企业服务热线|老年人直连热线|协议与规则|隐私政策|防骗指南|使用帮助|朝阳网警|电子营业执照|京ICP备|算法备案信息|BOSS\s*安全提示|个人综合排名|在人中排名第|加载中|请立即举报|违法和不良信息举报邮箱)/gi,kt=/\/web\/geek\/jobs/i,At=[`.job-intro-container [data-selector='job-intro-content']`,`[data-selector='job-intro-content']`,`.job-description`,`.job-detail`,`.job-detail-section`,`.describtion`,`.describtion-card__detail-content`,`.describtion__detail-content`,`.job-content`,`.content-word`,`.jobs-description-content__text`,`.jobs-description__content`,`.show-more-less-html__markup`,`.pos-ul`,`.intern_position_detail`,`.job_part .job_detail .intern-from-api`,`.intern_position_detail`,`.job_detail`,`[class*='job-detail']`,`[class*='job_description']`,`[class*='description']`],jt=[...`北京.上海.广州.深圳.杭州.成都.武汉.南京.天津.重庆.西安.苏州.宁波.长沙.郑州.青岛.沈阳.大连.济南.合肥.福州.厦门.珠海.东莞.佛山.无锡.常州.南通.昆明.贵阳.南昌.太原.石家庄.长春.哈尔滨.兰州.乌鲁木齐.呼和浩特.海口.三亚.温州.嘉兴.绍兴.金华.台州.湖州.烟台.潍坊.临沂.徐州.扬州.镇江.芜湖.惠州.中山.南宁.泉州.洛阳.唐山.保定.赣州.银川.拉萨.珠三角.长三角`.split(`.`)].sort((e,t)=>t.length-e.length),Mt=null,Nt=/(datePosted|pubDate|publishedAt|publishTime|publishDate|postedAt|upDate|updateTime|updatedAt)/i,Pt=/(登录|扫码|分享|举报|收藏|投诉|隐私政策|免责声明|公司介绍|公司简介|职位描述|岗位职责|任职要求|招聘信息)/i,Ft=!1,It=null,document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,qe):qe()})),Rt=r({matches:[`http://*/*`,`https://*/*`],runAt:`document_idle`,main(){Promise.resolve().then(()=>(Lt(),x))}}),zt={debug:(...e)=>([...e],void 0),log:(...e)=>([...e],void 0),warn:(...e)=>([...e],void 0),error:(...e)=>([...e],void 0)},Bt=globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome,Vt=class e extends Event{static EVENT_NAME=Ht(`wxt:locationchange`);constructor(t,n){super(e.EVENT_NAME,{}),this.newUrl=t,this.oldUrl=n}};function Ht(e){return`${Bt?.runtime?.id}:content:${e}`}var Ut=typeof globalThis.navigation?.addEventListener==`function`;function Wt(e){let t,n=!1;return{run(){n||(n=!0,t=new URL(location.href),Ut?globalThis.navigation.addEventListener(`navigate`,e=>{let n=new URL(e.destination.url);n.href!==t.href&&(window.dispatchEvent(new Vt(n,t)),t=n)},{signal:e.signal}):e.setInterval(()=>{let e=new URL(location.href);e.href!==t.href&&(window.dispatchEvent(new Vt(e,t)),t=e)},1e3))}}}var Gt=class e{static SCRIPT_STARTED_MESSAGE_TYPE=Ht(`wxt:content-script-started`);id;abortController;locationWatcher=Wt(this);constructor(e,t){this.contentScriptName=e,this.options=t,this.id=Math.random().toString(36).slice(2),this.abortController=new AbortController,this.stopOldScripts(),this.listenForNewerScripts()}get signal(){return this.abortController.signal}abort(e){return this.abortController.abort(e)}get isInvalid(){return Bt.runtime?.id??this.notifyInvalidated(),this.signal.aborted}get isValid(){return!this.isInvalid}onInvalidated(e){return this.signal.addEventListener(`abort`,e),()=>this.signal.removeEventListener(`abort`,e)}block(){return new Promise(()=>{})}setInterval(e,t){let n=setInterval(()=>{this.isValid&&e()},t);return this.onInvalidated(()=>clearInterval(n)),n}setTimeout(e,t){let n=setTimeout(()=>{this.isValid&&e()},t);return this.onInvalidated(()=>clearTimeout(n)),n}requestAnimationFrame(e){let t=requestAnimationFrame((...t)=>{this.isValid&&e(...t)});return this.onInvalidated(()=>cancelAnimationFrame(t)),t}requestIdleCallback(e,t){let n=requestIdleCallback((...t)=>{this.signal.aborted||e(...t)},t);return this.onInvalidated(()=>cancelIdleCallback(n)),n}addEventListener(e,t,n,r){t===`wxt:locationchange`&&this.isValid&&this.locationWatcher.run(),e.addEventListener?.(t.startsWith(`wxt:`)?Ht(t):t,n,{...r,signal:this.signal})}notifyInvalidated(){this.abort(`Content script context invalidated`),zt.debug(`Content script "${this.contentScriptName}" context invalidated`)}stopOldScripts(){document.dispatchEvent(new CustomEvent(e.SCRIPT_STARTED_MESSAGE_TYPE,{detail:{contentScriptName:this.contentScriptName,messageId:this.id}})),window.postMessage({type:e.SCRIPT_STARTED_MESSAGE_TYPE,contentScriptName:this.contentScriptName,messageId:this.id},`*`)}verifyScriptStartedEvent(e){let t=e.detail?.contentScriptName===this.contentScriptName,n=e.detail?.messageId===this.id;return t&&!n}listenForNewerScripts(){let t=e=>{!(e instanceof CustomEvent)||!this.verifyScriptStartedEvent(e)||this.notifyInvalidated()};document.addEventListener(e.SCRIPT_STARTED_MESSAGE_TYPE,t),this.onInvalidated(()=>document.removeEventListener(e.SCRIPT_STARTED_MESSAGE_TYPE,t))}},Kt={debug:(...e)=>([...e],void 0),log:(...e)=>([...e],void 0),warn:(...e)=>([...e],void 0),error:(...e)=>([...e],void 0)};return(async()=>{try{let{main:e,...t}=Rt;return await e(new Gt(`content`,t))}catch(e){throw Kt.error(`The content script "content" crashed on startup!`,e),e}})()})();
content;