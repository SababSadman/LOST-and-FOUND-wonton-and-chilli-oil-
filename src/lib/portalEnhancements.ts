export const PORTAL_ENHANCEMENT_STYLES = [
  '<style data-next-enhancements>',
  '@media(pointer:fine){html.next-enhanced,html.next-enhanced *{cursor:none!important}}',
  '#next-cursor{position:fixed;left:0;top:0;z-index:2147483647;width:10px;height:10px;',
  'margin:-5px;border:2px solid #f35a12;border-radius:50%;pointer-events:none;opacity:0;',
  'will-change:transform;box-shadow:0 0 0 7px rgba(243,90,18,.12);',
  'transition:transform .1s ease-out,width .2s,height .2s,margin .2s,background .2s,box-shadow .2s,opacity .2s}',
  '#next-cursor.active{width:38px;height:38px;margin:-19px;background:rgba(243,90,18,.08);',
  'box-shadow:0 0 0 1px rgba(243,90,18,.34)}',
  '#next-cursor.down{width:24px;height:24px;margin:-12px}',
  '@media(pointer:coarse),(prefers-reduced-motion:reduce){#next-cursor{display:none}}',
  '</style>',
].join('');

export const PORTAL_ENHANCEMENT_SCRIPT = [
  "<script data-next-enhancements>",
  "(()=>{if(!matchMedia('(pointer:fine)').matches)return;",
  "document.documentElement.classList.add('next-enhanced');",
  "const c=document.createElement('div');c.id='next-cursor';document.body.append(c);",
  "addEventListener('pointermove',e=>{c.style.opacity='1';",
  "c.style.transform='translate3d('+e.clientX+'px,'+e.clientY+'px,0)'},{passive:true});",
  "addEventListener('pointerover',e=>c.classList.toggle('active',!!e.target.closest?.(",
  "'a,button,input,select,textarea,[role=button]')),{passive:true});",
  "addEventListener('pointerdown',()=>c.classList.add('down'),{passive:true});",
  "addEventListener('pointerup',()=>c.classList.remove('down'),{passive:true});",
  "addEventListener('blur',()=>c.style.opacity='0')})();",
  "</script>",
].join('');
