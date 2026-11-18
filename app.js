const $ = s => document.querySelector(s);
const view = $("#view");
const KEY = "spravochnik-data-v1";
const CONFIG = "spravochnik-supabase-config";
let state = load();
let currentPage = "projects", projectId = null, sectionId = null, supabaseClient = null, syncTimer = null;

function uid(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36)}
function load(){try{return JSON.parse(localStorage.getItem(KEY))||{projects:[]}}catch{return {projects:[]}}}
function saveLocal(){localStorage.setItem(KEY,JSON.stringify(state)); scheduleSync()}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400)}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function project(){return state.projects.find(p=>p.id===projectId)}
function findSection(list,id){for(const s of list||[]){if(s.id===id)return s;const r=findSection(s.children,id);if(r)return r}return null}
function currentSection(){return findSection(project()?.sections,sectionId)}
function allSections(list,out=[]){(list||[]).forEach(s=>{out.push(s);allSections(s.children,out)});return out}
function nav(page){currentPage=page;projectId=null;sectionId=null;document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));render()}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>nav(b.dataset.page)));
$("#mobileHome").onclick=()=>nav("projects");
$("#addTopBtn").onclick=()=> currentPage==="projects" ? projectForm() : currentPage==="project" ? sectionForm() : toast("Откройте проект, чтобы добавить раздел");
$("#searchBtn").onclick=showSearch;
$("#menuBtn").onclick=()=>toast("Изменения сохраняются автоматически");
$("#modalClose").onclick=closeModal;
$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal()});

function render(){
 const crumb=$("#breadcrumbs");
 if(currentPage==="settings"){crumb.textContent="Настройки";renderSettings();return}
 if(currentPage==="projects"){crumb.textContent="Проекты";renderProjects();return}
 const p=project(); if(!p){nav("projects");return}
 crumb.textContent=p.name+(currentSection()?" / "+currentSection().title:"");
 renderProject();
}
function renderProjects(){
 view.innerHTML=`<div class="page-title"><div><h1>Мои проекты</h1><div class="subtle">Собирайте знания в удобные визуальные справочники</div></div><button class="primary" id="newProject">＋ Новый проект</button></div>`;
 if(!state.projects.length){view.innerHTML+=`<div class="empty"><div class="emoji">📚</div><h3>Пока нет проектов</h3><p>Создайте первый справочник — например, «Электроника» или «Работа».</p><button class="primary" id="emptyCreate">Создать проект</button></div>`}
 else {view.innerHTML+=`<div class="project-grid">${state.projects.map(p=>`<article class="project-card" data-project="${p.id}"><div class="project-cover">${p.cover?`<img src="${p.cover}">`:`${esc(p.icon||"📘")}`}</div><div class="project-meta"><h3>${esc(p.name)}</h3><p>${allSections(p.sections).length} разделов · ${esc(p.description||"Личный справочник")}</p></div></article>`).join("")}</div>`}
 $("#newProject")?.addEventListener("click",projectForm);$("#emptyCreate")?.addEventListener("click",projectForm);
 view.querySelectorAll("[data-project]").forEach(el=>el.onclick=()=>{projectId=el.dataset.project;currentPage="project";const first=allSections(project().sections)[0];sectionId=first?.id||null;render()});
}
function projectForm(){
 showModal("Новый проект",`<div class="field"><label>Название проекта</label><input id="fName" placeholder="Например, Электроника"></div><div class="field"><label>Краткое описание</label><input id="fDesc" placeholder="О чём этот справочник?"></div><div class="field"><label>Эмодзи или символ</label><input id="fIcon" value="📘" maxlength="4"></div>`, "Создать",()=>{
 const name=$("#fName").value.trim();if(!name)return toast("Введите название");
 state.projects.push({id:uid(),name,description:$("#fDesc").value.trim(),icon:$("#fIcon").value||"📘",sections:[]});saveLocal();closeModal();render();toast("Проект создан");
 });
}
function renderProject(){
 const p=project(),s=currentSection();
 view.innerHTML=`<div class="page-title"><div><h1>${esc(p.name)}</h1><div class="subtle">${esc(p.description||"Ваш личный справочник")}</div></div><div class="row"><button class="secondary" id="editProject">Настроить проект</button><button class="primary" id="newSection">＋ Раздел</button></div></div>
 <div class="project-layout"><aside class="tree-panel" id="treePanel"><div class="tree-head"><b>Разделы проекта</b><button class="tree-add" id="treeAdd" title="Добавить раздел">＋</button></div><div class="tree-inner">${renderTree(p.sections,0)}</div></aside><section class="content-panel" id="contentPanel">${s?renderSectionContent(s):`<div class="empty"><div class="emoji">🧭</div><h3>Начните с первого раздела</h3><p>Создайте раздел или подраздел, добавьте текст, изображения и ссылки.</p><button class="primary" id="firstSection">Создать раздел</button></div>`}</section></div>`;
 $("#newSection").onclick=()=>sectionForm();$("#treeAdd").onclick=()=>sectionForm();$("#firstSection")?.addEventListener("click",()=>sectionForm());
 $("#editProject").onclick=()=>editProjectForm();
 view.querySelectorAll("[data-section]").forEach(b=>b.onclick=()=>{sectionId=b.dataset.section;render()});
 view.querySelectorAll("[data-card][data-target]").forEach(b=>b.onclick=()=>{if(b.dataset.target){sectionId=b.dataset.target;render()}});
 view.querySelectorAll("[data-add-child]").forEach(b=>b.onclick=e=>{e.stopPropagation();sectionForm(b.dataset.addChild)});
 view.querySelectorAll("[data-edit-section]").forEach(b=>b.onclick=e=>{e.stopPropagation();editSectionForm(b.dataset.editSection)});
 view.querySelectorAll("[data-del-section]").forEach(b=>b.onclick=e=>{e.stopPropagation();deleteSection(b.dataset.delSection)});
 $("#editCurrent")?.addEventListener("click",()=>editSectionForm(s.id));
 $("#addChildCurrent")?.addEventListener("click",()=>sectionForm(s.id));
 $("#editContent")?.addEventListener("click",()=>contentForm(s));
 $("#deleteCurrent")?.addEventListener("click",()=>deleteSection(s.id));
}
function renderTree(list,depth){
 return (list||[]).map(s=>`<div class="tree-row"><button class="tree-toggle">${s.children?.length?"⌄":"·"}</button><button class="tree-link ${s.id===sectionId?"active":""}" data-section="${s.id}">${esc(s.title)}</button><button class="tree-add" data-add-child="${s.id}" title="Подраздел">＋</button></div>${s.children?.length?`<div class="tree-children">${renderTree(s.children,depth+1)}</div>`:""}`).join("");
}
function renderSectionContent(s){
 const cards=(s.cards||[]).map(c=>`<div class="tile ${c.image?"":"plain"}" style="--tile-bg:${esc(c.color||"#e7f0ff")};--tile-ink:${esc(c.ink||"#24436e")}" data-card="${c.id}" data-target="${c.target||""}">${c.image?`<img src="${c.image}">`:""}<div class="tile-title">${esc(c.title)}</div></div>`).join("");
 const resources=(s.links||[]).map(l=>`<a class="resource" href="${esc(l.url)}" target="_blank" rel="noopener">↗ ${esc(l.title||l.url)}</a>`).join("");
 return `<div class="content-toolbar"><h2>${esc(s.title)}</h2><div class="toolbar-buttons"><button class="small-btn" id="editCurrent">Изменить</button><button class="small-btn" id="addChildCurrent">＋ Подраздел</button><button class="small-btn" id="deleteCurrent">Удалить</button></div></div>
 ${s.image?`<div class="hero"><img src="${s.image}"><div class="hero-copy"><h1>${esc(s.title)}</h1><p>${esc(s.subtitle||"")}</p></div></div>`:`<div class="hero" style="background:linear-gradient(120deg,${esc(s.color||"#2368a6")},#172d50)"><div class="hero-copy"><h1>${esc(s.title)}</h1><p>${esc(s.subtitle||"")}</p></div></div>`}
 ${s.description?`<div class="info-box">${esc(s.description)}</div>`:""}
 ${s.body?`<h3 class="section-label">Заметки</h3><div class="note-body">${formatText(s.body)}</div>`:""}
 ${s.cards?.length?`<h3 class="section-label">Подразделы и карточки</h3><div class="tile-grid">${cards}</div>`:""}
 ${resources?`<h3 class="section-label">Полезные ссылки</h3><div class="resource-list">${resources}</div>`:""}
 ${!s.description&&!s.body&&!s.cards?.length&&!resources?`<div class="empty"><div class="emoji">✏️</div><h3>Этот раздел пока пуст</h3><p>Добавьте заметку, картинку или визуальные карточки-переходы.</p><button class="primary" id="editContent">Добавить содержимое</button></div>`:`<div style="margin-top:18px"><button class="secondary" id="editContent">＋ Редактировать содержимое</button></div>`}`;
}
function formatText(t){return esc(t).replace(/\n/g,"<br>").replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>')}
function sectionForm(parentId=null){
 showModal(parentId?"Новый подраздел":"Новый раздел",`<div class="field"><label>Название</label><input id="fTitle" placeholder="Название раздела"></div><div class="field"><label>Короткое описание</label><input id="fDesc" placeholder="Необязательно"></div><div class="field"><label>Визуальный стиль</label><select id="fStyle"><option value="plain">Цветная карточка</option><option value="image">Картинка / обложка</option></select></div><div class="field"><label>Цвет карточки</label><input id="fColor" type="color" value="#dceaff"></div><div class="field"><label>Картинка (необязательно)</label><input id="fImage" type="file" accept="image/*"><div class="hint">Картинка может быть обложкой раздела. Её можно сжать автоматически.</div></div>`, "Создать",async()=>{
 const title=$("#fTitle").value.trim();if(!title)return toast("Введите название");
 const image=await fileToData($("#fImage").files[0]);
 const obj={id:uid(),title,subtitle:"",description:$("#fDesc").value.trim(),color:$("#fColor").value,image,body:"",cards:[],links:[],children:[]};
 const dest=parentId?findSection(project().sections,parentId).children:project().sections;dest.push(obj);sectionId=obj.id;saveLocal();closeModal();render();toast("Раздел создан");
 });
}
function editSectionForm(id){
 const s=findSection(project().sections,id);
 showModal("Настройки раздела",`<div class="field"><label>Название</label><input id="fTitle" value="${esc(s.title)}"></div><div class="field"><label>Подзаголовок</label><input id="fSub" value="${esc(s.subtitle||"")}"></div><div class="field"><label>Описание</label><input id="fDesc" value="${esc(s.description||"")}"></div><div class="field"><label>Цвет обложки</label><input id="fColor" type="color" value="${esc(s.color||"#2368a6")}"></div><div class="field"><label>Заменить обложку</label><input id="fImage" type="file" accept="image/*"></div>`, "Сохранить",async()=>{
 s.title=$("#fTitle").value.trim()||s.title;s.subtitle=$("#fSub").value;s.description=$("#fDesc").value;s.color=$("#fColor").value;const im=await fileToData($("#fImage").files[0]);if(im)s.image=im;saveLocal();closeModal();render();toast("Изменения сохранены");
 });
}
function contentForm(s){
 showModal("Содержимое раздела",`<div class="field"><label>Текст заметки</label><textarea id="fBody" placeholder="Запишите важную информацию...">${esc(s.body||"")}</textarea></div><div class="field"><label>Добавить визуальную карточку-переход</label><input id="cTitle" placeholder="Например, Резисторы"></div><div class="field"><label>Картинка карточки</label><input id="cImage" type="file" accept="image/*"></div><div class="field"><label>Цвет карточки (если без картинки)</label><input id="cColor" type="color" value="#d9edff"></div><div class="field"><label>Куда ведёт карточка</label><select id="cTarget"><option value="">Создать карточку без перехода</option>${allSections(project().sections).filter(x=>x.id!==s.id).map(x=>`<option value="${x.id}">${esc(x.title)}</option>`).join("")}</select></div><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><div class="field"><label>Название внешней ссылки</label><input id="lTitle" placeholder="Например, Техническая документация"></div><div class="field"><label>Адрес ссылки</label><input id="lUrl" placeholder="https://..."></div><div class="hint">Визуальная карточка может вести в существующий подраздел. Для создания нового подраздела используйте кнопку «Подраздел».</div>`, "Сохранить",async()=>{
 s.body=$("#fBody").value;
 const ct=$("#cTitle").value.trim();if(ct){const img=await fileToData($("#cImage").files[0]);s.cards=s.cards||[];s.cards.push({id:uid(),title:ct,image:img,color:$("#cColor").value,target:$("#cTarget").value||null});}
 const lt=$("#lTitle").value.trim(),lu=$("#lUrl").value.trim();if(lt&&lu){s.links=s.links||[];s.links.push({title:lt,url:lu})}
 saveLocal();closeModal();render();toast("Содержимое сохранено");
 });
}
function editProjectForm(){
 const p=project();showModal("Настройки проекта",`<div class="field"><label>Название</label><input id="fName" value="${esc(p.name)}"></div><div class="field"><label>Описание</label><input id="fDesc" value="${esc(p.description||"")}"></div><div class="field"><label>Эмодзи</label><input id="fIcon" value="${esc(p.icon||"📘")}"></div><button class="danger" id="deleteProject">Удалить проект</button>`, "Сохранить",()=>{
 p.name=$("#fName").value.trim()||p.name;p.description=$("#fDesc").value;p.icon=$("#fIcon").value;saveLocal();closeModal();render();
 });$("#deleteProject").onclick=()=>{if(confirm("Удалить проект и все его разделы?")){state.projects=state.projects.filter(x=>x.id!==p.id);saveLocal();closeModal();nav("projects")}};
}
function deleteSection(id){if(!confirm("Удалить раздел вместе со всеми вложенными подразделами?"))return;function del(arr){const i=arr.findIndex(x=>x.id===id);if(i>=0){arr.splice(i,1);return true}return arr.some(x=>del(x.children||[]))}del(project().sections);sectionId=allSections(project().sections)[0]?.id||null;saveLocal();render();toast("Раздел удалён")}
function showModal(title,html,okText,onOk){$("#modalTitle").textContent=title;$("#modalBody").innerHTML=html;$("#modalActions").innerHTML=`<button class="secondary" id="cancelModal">Отмена</button><button class="primary" id="confirmModal">${okText}</button>`;$("#modalBackdrop").classList.remove("hidden");$("#cancelModal").onclick=closeModal;$("#confirmModal").onclick=onOk}
function closeModal(){$("#modalBackdrop").classList.add("hidden")}
async function fileToData(file){if(!file)return null;if(file.size>8*1024*1024){toast("Выберите изображение меньше 8 МБ");return null}return new Promise(resolve=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const c=document.createElement("canvas"),scale=Math.min(1,1400/img.width,1400/img.height);c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext("2d").drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.78))};img.onerror=()=>resolve(r.result);img.src=r.result};r.readAsDataURL(file)})}
function renderSettings(){
 const cfg=getConfig();
 view.innerHTML=`<div class="page-title"><div><h1>Настройки</h1><div class="subtle">Синхронизация и данные справочника</div></div></div>
 <div class="settings-card"><h3>☁️ Синхронизация между Android и Windows</h3><p class="subtle">Для облачной синхронизации подключите бесплатный проект Supabase. После настройки один и тот же аккаунт будет видеть одинаковые проекты на всех устройствах.</p>
 <div class="field"><label>Supabase Project URL</label><input id="sbUrl" placeholder="https://xxxx.supabase.co" value="${esc(cfg.url||"")}"></div><div class="field"><label>Supabase anon public key</label><textarea id="sbKey" placeholder="Вставьте anon / publishable key">${esc(cfg.key||"")}</textarea></div><div class="row"><button class="primary" id="connectCloud">Подключить и войти</button><button class="secondary" id="disconnectCloud">Отключить</button></div><p class="hint">Ключ должен быть именно публичным anon/publishable key, не service_role. Схема таблицы находится в файле supabase_schema.sql внутри архива.</p><div class="hint" id="cloudInfo">${supabaseClient?"Облако подключено.":"Пока данные хранятся только на этом устройстве."}</div></div>
 <div class="settings-card"><h3>📦 Резервная копия</h3><p class="subtle">Экспортируйте справочник в файл или восстановите его на другом устройстве.</p><div class="row"><button class="secondary" id="exportData">Скачать резервную копию</button><label class="secondary" style="cursor:pointer">Импортировать файл<input type="file" id="importData" accept="application/json" hidden></label></div></div>
 <div class="settings-card"><h3>О приложении</h3><p class="subtle">Мой справочник · версия 1.0. Работает в браузере на Android и Windows. Можно установить как приложение через меню браузера.</p></div>`;
 $("#connectCloud").onclick=connectCloud;$("#disconnectCloud").onclick=()=>{localStorage.removeItem(CONFIG);supabaseClient=null;$("#syncState").classList.remove("online");$("#syncState span").textContent="Только на этом устройстве";toast("Облачная синхронизация отключена")};
 $("#exportData").onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});download(blob,"spravochnik-backup.json")};
 $("#importData").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!Array.isArray(d.projects))throw 0;state=d;saveLocal();render();toast("Резервная копия восстановлена")}catch{toast("Не удалось прочитать файл")}};
}
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href)}
function getConfig(){try{return JSON.parse(localStorage.getItem(CONFIG))||{}}catch{return {}}}
async function connectCloud(){
 const url=$("#sbUrl").value.trim(),key=$("#sbKey").value.trim();if(!url||!key)return toast("Введите URL и публичный ключ");
 localStorage.setItem(CONFIG,JSON.stringify({url,key}));
 try{await initCloud();}catch(e){toast("Не удалось подключиться: "+(e.message||"проверьте настройки"));console.error(e)}
}
async function initCloud(){
 const c=getConfig();if(!c.url||!c.key||!window.supabase)return;
 supabaseClient=window.supabase.createClient(c.url,c.key);
 let {data:{session}}=await supabaseClient.auth.getSession();
 if(!session){showModal("Вход в облако",`<p class="subtle">Введите email и пароль. Если аккаунта ещё нет, нажмите «Создать аккаунт».</p><div class="field"><label>Email</label><input id="authEmail" type="email" placeholder="you@example.com"></div><div class="field"><label>Пароль</label><input id="authPass" type="password" placeholder="Не менее 6 символов"></div>`, "Войти",async()=>{const email=$("#authEmail").value.trim(),password=$("#authPass").value;if(!email||!password)return toast("Введите email и пароль");const {error}=await supabaseClient.auth.signInWithPassword({email,password});if(error){toast(error.message);return}closeModal();await cloudLoad()});
 $("#modalActions").insertAdjacentHTML("afterbegin",`<button class="secondary" id="signUp">Создать аккаунт</button>`);$("#signUp").onclick=async()=>{const email=$("#authEmail").value.trim(),password=$("#authPass").value;if(!email||password.length<6)return toast("Введите email и пароль от 6 символов");const {error}=await supabaseClient.auth.signUp({email,password});if(error)toast(error.message);else toast("Аккаунт создан. Если включено подтверждение email — подтвердите адрес, затем войдите.")};
 }else await cloudLoad();
}
async function cloudLoad(){
 const {data:{user}}=await supabaseClient.auth.getUser();if(!user)return;
 const {data,error}=await supabaseClient.from("user_notebooks").select("content").eq("user_id",user.id).maybeSingle();
 if(error){toast("Ошибка чтения облака: "+error.message);return}
 if(data?.content?.projects?.length){state=data.content;localStorage.setItem(KEY,JSON.stringify(state))}
 else await cloudSave();
 $("#syncState").classList.add("online");$("#syncState span").textContent="Синхронизировано";render();toast("Облачные данные загружены");
}
async function cloudSave(){
 if(!supabaseClient)return;
 const {data:{user}}=await supabaseClient.auth.getUser();if(!user)return;
 const {error}=await supabaseClient.from("user_notebooks").upsert({user_id:user.id,content:state,updated_at:new Date().toISOString()},{onConflict:"user_id"});
 if(error){console.error(error);$("#syncState span").textContent="Ошибка синхронизации";return}
 $("#syncState").classList.add("online");$("#syncState span").textContent="Синхронизировано";
}
function scheduleSync(){if(!supabaseClient)return;$("#syncState span").textContent="Сохранение…";clearTimeout(syncTimer);syncTimer=setTimeout(cloudSave,1200)}
function showSearch(){
 showModal("Поиск по справочнику",`<input class="search-input" id="searchText" placeholder="Введите название или текст..."><div id="searchResults"></div>`, "Закрыть",closeModal);
 const input=$("#searchText"),results=$("#searchResults");input.oninput=()=>{const q=input.value.toLowerCase().trim();if(!q){results.innerHTML="";return}const found=[];state.projects.forEach(p=>allSections(p.sections).forEach(s=>{if((s.title+" "+s.description+" "+s.body).toLowerCase().includes(q))found.push({p,s})}));results.innerHTML=found.length?found.map(x=>`<button class="resource" style="width:100%;text-align:left" data-found="${x.p.id}|${x.s.id}">${esc(x.p.name)} / ${esc(x.s.title)}</button>`).join(""):`<p class="subtle">Ничего не найдено</p>`;results.querySelectorAll("[data-found]").forEach(b=>b.onclick=()=>{const [pid,sid]=b.dataset.found.split("|");projectId=pid;sectionId=sid;currentPage="project";closeModal();render()})};setTimeout(()=>input.focus(),50)
}
window.addEventListener("online",()=>{if(supabaseClient)cloudSave()});
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(()=>{});
const cfg=getConfig();if(cfg.url&&cfg.key){initCloud().catch(console.error)}
render();
