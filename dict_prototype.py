#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
多功能字典原型 — 单文件可运行
用法: python dict_prototype.py
访问: http://localhost:5050
"""

import json, os, sys, re
# wordfreq 可能安装在 user site-packages
import site
sys.path.insert(0, site.getusersitepackages())
from wordfreq import word_frequency
from flask import Flask, request, jsonify, Response

# --- 韵部排序 ---
PINGSHUIYUN_ORDER = [
    '一东','二冬','三江','四支','五微','六鱼','七虞','八齐','九佳','十灰',
    '十一真','十二文','十三元','十四寒','十五删',
    '一先','二萧','三肴','四豪','五歌','六麻','七阳','八庚','九青','十蒸',
    '十一尤','十二侵','十三覃','十四盐','十五咸',
    '一董','二肿','三讲','四纸','五尾','六语','七麌','八荠','九蟹','十贿',
    '十一轸','十二吻','十三阮','十四旱','十五潸','十六铣','十七筱','十八巧','十九皓',
    '二十哿','二十一马','二十二养','二十三梗','二十四迥','二十五有','二十六寝','二十七感','二十八俭','二十九豏',
    '一送','二宋','三绛','四寘','五未','六御','七遇','八霁','九泰','十卦',
    '十一队','十二震','十三问','十四愿','十五翰','十六谏','十七霰','十八啸','十九效','二十号',
    '二十一个','二十二祃','二十三漾','二十四敬','二十五径','二十六宥','二十七沁','二十八勘','二十九艳','三十陷',
    '一屋','二沃','三觉','四质','五物','六月','七曷','八黠','九屑','十药',
    '十一陌','十二锡','十三职','十四缉','十五合','十六叶','十七洽',
]
_PSY_MAP = {n: i for i, n in enumerate(PINGSHUIYUN_ORDER)}
def _sort_key(book, name):
    if book == 'Pingshuiyun':
        return _PSY_MAP.get(name, 999)
    m = re.match(r'第(\d+)部_(.+)', name)
    if not m: return (999, 0)
    return (int(m.group(1)), {'平':0,'仄':1,'入':2}.get(m.group(2), 3))

app = Flask(__name__)

# ---------- 加载数据 ----------
CFG = "static/config"
print("加载数据 ...")
with open(f"{CFG}/char_dict.json", "r") as f:
    CHAR_DICT = json.load(f)
with open(f"{CFG}/rhyme_books.json", "r") as f:
    RHYME_BOOKS = json.load(f)
with open(f"{CFG}/phrase_head.json", "r") as f:
    PHRASE_HEAD = json.load(f)
with open(f"{CFG}/phrase_tail.json", "r") as f:
    PHRASE_TAIL = json.load(f)
with open(f"{CFG}/phrase_pairs.json", "r") as f:
    PHRASE_PAIRS = json.load(f)
print(f"就绪: {len(CHAR_DICT)} 字, {len(PHRASE_HEAD)} 首字, {len(PHRASE_TAIL)} 末字, {len(PHRASE_PAIRS)} 对语")

# ---------- API ----------
@app.route("/api/char/lookup")
def char_lookup():
    ch = request.args.get("char", "")
    book = request.args.get("book", "Pingshuiyun")
    info = CHAR_DICT.get(ch)
    if not info:
        return jsonify({"char": ch, "tones": [], "rhyme_categories": []})
    cats_raw = info.get("rhymes", {}).get(book, [])
    seen = set()
    cats = []
    for c in cats_raw:
        if c not in seen:
            seen.add(c)
            tone_type = ""
            bk = RHYME_BOOKS.get(book, {}).get("categories", {}).get(c, {})
            if bk:
                tone_type = bk.get("tone_type", "")
            cats.append({"name": c, "tone_type": tone_type})
    cats.sort(key=lambda x: _sort_key(book, x["name"]))
    return jsonify({"char": ch, "tones": info.get("tones", []), "rhyme_categories": cats})

@app.route("/api/rhyme/lookup")
def rhyme_lookup():
    book = request.args.get("book", "Pingshuiyun")
    cat = request.args.get("category", "")
    bk = RHYME_BOOKS.get(book, {}).get("categories", {}).get(cat, {})
    if not bk:
        return jsonify({"error": "not found"})
    chars = sorted(bk["characters"], key=lambda c: -word_frequency(c, 'zh'))  # 按词频降序
    return jsonify({
        "category_name": bk["name"], "tone_type": bk["tone_type"],
        "total": len(chars),
        "characters": chars,  # 全量返回
        "relations": bk.get("relations", {})
    })

@app.route("/api/dictionary/search")
def dict_search():
    term = request.args.get("term", "")
    mode = request.args.get("mode", "head")
    length = request.args.get("length", "2")
    tone = request.args.get("tone", "all")
    if mode == "pair":
        return jsonify(PHRASE_PAIRS.get(term, []))
    src = PHRASE_HEAD if mode == "head" else PHRASE_TAIL
    entry = src.get(term, {})
    if length == "all":
        return jsonify(entry)
    len_data = entry.get(length, {})
    if tone in ("P", "Z"):
        return jsonify(len_data.get(tone, []))
    merged = {}
    for t in ["P", "Z"]:
        for w, c in len_data.get(t, []):
            merged[w] = max(merged.get(w, 0), c)
    return jsonify(sorted(merged.items(), key=lambda x: -x[1]))

# ---------- 前端 ----------
HTML = r"""<!DOCTYPE html>
<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>多功能字典 · 原型</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,"Noto Sans SC",sans-serif;background:#FBFBF6;color:#1a1a1a;display:flex;justify-content:center;padding:24px}
.wrap{width:100%;max-width:560px}
h2{text-align:center;font-size:18px;margin-bottom:16px;color:#555}
.input-row{display:flex;gap:8px;margin-bottom:12px}
.input-row input{flex:1;height:40px;border:1.5px solid #ccc;border-radius:8px;padding:0 12px;font-size:16px;outline:none;transition:.2s}
.input-row input:focus{border-color:#6366f1}
.input-row button{height:40px;padding:0 20px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer}
.input-row button:hover{background:#4f46e5}
.tabs{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.tab{padding:5px 14px;border-radius:16px;font-size:13px;cursor:pointer;border:1.5px solid #ddd;background:#fff;transition:.15s;user-select:none}
.tab.active{background:#6366f1;color:#fff;border-color:#6366f1}
.tab:hover:not(.active){background:#f0f0ff}
.tab.hidden{display:none}
.filters{display:flex;gap:16px;margin-bottom:10px;align-items:center;flex-wrap:wrap}
.filter-group{display:flex;gap:4px;align-items:center}
.filter-group label{font-size:12px;color:#888;margin-right:4px}
.pill{padding:3px 10px;border-radius:12px;font-size:12px;cursor:pointer;border:1px solid #ddd;background:#fff;transition:.15s;user-select:none}
.pill.active{background:#4f46e5;color:#fff;border-color:#4f46e5}
.pill:hover:not(.active){background:#f0f0ff}
/* 结果容器 */
#results{max-height:460px;overflow-y:auto}
#results:empty::after{content:"输入文字后点击搜索";display:block;text-align:center;padding:40px;color:#bbb;font-size:14px;background:#fff;border-radius:10px;border:1px solid #e5e5e5}
/* 词语 flow 布局 */
.flow{background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:10px 12px;line-height:2.1;overflow-wrap:break-word}
.flow .item{display:inline;margin-right:10px;font-size:14.5px;white-space:nowrap}
.flow .item .ct{font-size:11px;color:#aaa;margin-left:1px}
.flow-empty{text-align:center;padding:36px;color:#bbb;font-size:14px}
/* 韵部 */
.rhyme-header{display:flex;align-items:baseline;gap:6px;margin-bottom:8px}
.rhyme-header b{font-size:18px}
.rhyme-header .tone-badge{font-size:12px;color:#888}
.rhyme-tags{margin-bottom:10px;display:flex;flex-wrap:wrap;gap:4px}
.rhyme-tag{padding:3px 10px;border-radius:6px;font-size:13px;cursor:pointer;transition:.12s;border:1px solid #e0e0ff;background:#f0f0ff;user-select:none}
.rhyme-tag:hover{background:#e0e0ff}
.rhyme-tag.active{background:#6366f1;color:#fff;border-color:#6366f1}
.rhyme-tag.ping{background:#e8f5e9;border-color:#c8e6c9}
.rhyme-tag.ping.active{background:#388e3c;border-color:#388e3c;color:#fff}
.rhyme-tag.ze{background:#fff3e0;border-color:#ffe0b2}
.rhyme-tag.ze.active{background:#f57c00;border-color:#f57c00;color:#fff}
.rhyme-chars{line-height:2.2;font-size:15px;color:#333;letter-spacing:3px;padding:10px 12px;background:#fff;border:1px solid #e5e5e5;border-radius:10px;overflow-wrap:break-word}
.rhyme-chars .cat-label{display:block;font-size:12px;color:#999;letter-spacing:0;margin-bottom:2px}
</style></head><body>
<div class="wrap">
<h2>多功能字典 · 原型</h2>
<div class="input-row">
  <input id="inp" placeholder="输入汉字..." maxlength="4" autofocus>
  <button onclick="doSearch()">搜索</button>
</div>
<div class="tabs" id="tabs">
  <div class="tab active" data-tab="rhyme" onclick="switchTab('rhyme')">韵部</div>
  <div class="tab" data-tab="head" onclick="switchTab('head')">词首</div>
  <div class="tab" data-tab="tail" onclick="switchTab('tail')">词末</div>
  <div class="tab" data-tab="pair" onclick="switchTab('pair')">对语</div>
</div>
<div class="filters" id="filters" style="display:none">
  <div class="filter-group"><label>字数</label>
    <div class="pill active" data-len="2" onclick="setLen(this)">2字</div>
    <div class="pill" data-len="3" onclick="setLen(this)">3字</div>
    <div class="pill" data-len="4" onclick="setLen(this)">4字</div>
  </div>
  <div class="filter-group"><label>邻字</label>
    <div class="pill active" data-tone="all" onclick="setTone(this)">全部</div>
    <div class="pill" data-tone="P" onclick="setTone(this)">平</div>
    <div class="pill" data-tone="Z" onclick="setTone(this)">仄</div>
  </div>
</div>
<div id="results"></div>
</div>
<script>
let curTab='rhyme',curLen='2',curTone='all',curTerm='';
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const enc=s=>encodeURIComponent(s);
const ft=async u=>{const r=await fetch(u);return r.json()};

function switchTab(t){curTab=t;$$('.tab').forEach(e=>e.classList.toggle('active',e.dataset.tab===t));$('#filters').style.display=(t==='head'||t==='tail')?'flex':'none';if(curTerm)doSearch()}
function setLen(el){curLen=el.dataset.len;el.parentElement.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));el.classList.add('active');if(curTerm)doSearch()}
function setTone(el){curTone=el.dataset.tone;el.parentElement.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));el.classList.add('active');if(curTerm)doSearch()}

$('#inp').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch()});
$('#inp').addEventListener('input',()=>{
  const v=$('#inp').value.trim(),multi=v.length>1;
  $$('.tab').forEach(e=>{e.dataset.tab==='pair'?e.classList.remove('hidden'):e.classList.toggle('hidden',multi)});
  if(multi&&curTab!=='pair')switchTab('pair');
  else if(!multi&&curTab==='pair')switchTab('rhyme');
});

async function doSearch(){
  curTerm=$('#inp').value.trim();
  if(!curTerm){$('#results').innerHTML='';return}
  if(curTab==='rhyme')return doRhyme(curTerm);
  if(curTab==='pair')return doPair(curTerm);
  const data=await ft(`/api/dictionary/search?term=${enc(curTerm)}&mode=${curTab}&length=${curLen}&tone=${curTone}`);
  renderFlow(data);
}

/* --- 韵部 --- */
async function doRhyme(ch){
  const r=await ft(`/api/char/lookup?char=${enc(ch)}&book=Pingshuiyun`);
  if(!r.rhyme_categories||!r.rhyme_categories.length){
    $('#results').innerHTML=`<div class="rhyme-header"><b>${ch}</b><span class="tone-badge">${(r.tones||[]).join('/')}</span></div><div class="rhyme-chars"><span style="color:#bbb">未找到韵部信息</span></div>`;return}
  let h=`<div class="rhyme-header"><b>${ch}</b><span class="tone-badge">${(r.tones||[]).join('/')}</span></div><div class="rhyme-tags">`;
  r.rhyme_categories.forEach((c,i)=>{
    const cls=c.tone_type==='P'?'ping':'ze';
    h+=`<span class="rhyme-tag ${cls}${i===0?' active':''}" onclick="pickCat(this,'${c.name}')">${c.name}</span>`;
  });
  h+=`</div><div class="rhyme-chars" id="rchars"></div>`;
  $('#results').innerHTML=h;
  showCat(r.rhyme_categories[0].name);
}
function pickCat(el,name){el.parentElement.querySelectorAll('.rhyme-tag').forEach(t=>t.classList.remove('active'));el.classList.add('active');showCat(name)}
async function showCat(name){
  const r=await ft(`/api/rhyme/lookup?book=Pingshuiyun&category=${enc(name)}`);
  const el=$('#rchars');if(!el)return;
  el.innerHTML=`<span class="cat-label">${name} · ${r.total} 字</span>`+(r.characters||[]).join(' ');
}

/* --- 对语 --- */
async function doPair(term){
  const data=await ft(`/api/dictionary/search?term=${enc(term)}&mode=pair`);
  renderFlow(data);
}

/* --- flow 渲染 --- */
function renderFlow(data){
  if(!data||!data.length){$('#results').innerHTML='<div class="flow"><span class="flow-empty">无结果</span></div>';return}
  const items=data.map(d=>{
    const w=Array.isArray(d)?d[0]:d,c=Array.isArray(d)?d[1]:'';
    return `<span class="item">${w}<span class="ct">${c}</span></span>`;
  }).join('');
  $('#results').innerHTML=`<div class="flow">${items}</div>`;
}
</script></body></html>"""

@app.route("/")
def index():
    return Response(HTML, content_type="text/html; charset=utf-8")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=False)
