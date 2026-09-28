"""Optional maintenance utility: regenerate formatted docs after editing Markdown.
Requires markdown-it-py or Pandoc; no production dependency.
The generated HTML copies are already included in the release.
"""
from pathlib import Path
from html import escape
import re
try:
 from markdown_it import MarkdownIt
except ImportError:
 MarkdownIt=None
 import subprocess
ROOT=Path(__file__).resolve().parents[1]
md=MarkdownIt('commonmark',{'html':True}).enable('table') if MarkdownIt else None
style='''*{box-sizing:border-box}body{margin:0;background:#f5f7fb;color:#21314b;font:16px/1.7 system-ui,-apple-system,sans-serif}main{max-width:1020px;margin:40px auto 80px;background:white;padding:40px 52px;border:1px solid #e1e7f0;border-radius:12px}nav{max-width:1020px;margin:26px auto;display:flex;gap:20px;flex-wrap:wrap;padding:0 12px}a{color:#3159ef;text-decoration:none}a:hover{text-decoration:underline}h1,h2,h3{line-height:1.2;letter-spacing:-.025em;color:#142844}h1{font-size:38px;margin-top:0}h2{font-size:25px;margin-top:2em;padding-top:12px;border-top:1px solid #edf1f6}h3{font-size:19px;margin-top:1.7em}p{max-width:85ch}pre{overflow:auto;background:#f1f4fa;border:1px solid #e3e8f1;padding:18px;border-radius:7px;font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em}p code,li code{background:#f1f4fa;padding:2px 4px;border-radius:3px}table{border-collapse:collapse;width:100%;font-size:14px;display:block;overflow-x:auto}th,td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid #e5eaf2;min-width:115px}th{background:#eef2fa}li{margin:8px 0}blockquote{border-left:3px solid #3159ef;margin-left:0;padding-left:20px;color:#566984}footer{margin-top:44px;color:#6b7b91;font-size:13px}a,td{overflow-wrap:anywhere}@media(max-width:700px){main{margin:16px 12px;padding:26px 20px}h1{font-size:30px}}@media print{body{background:white;font-size:10pt}main{border:0;margin:0;padding:0}nav{display:none}pre{white-space:pre-wrap}a{color:inherit}h2{break-after:avoid}table{display:table}}'''
nav='<nav><strong>Fitts Lab / guides</strong> <a href="../index.html">Participant</a> <a href="../classroom.html">Classroom</a> <a href="DEPLOYMENT.html">Deployment</a> <a href="TEACHING.html">Teaching</a> <a href="METHODS.html">Methods</a> <a href="NOTEBOOK.html">Notebook</a> <a href="TESTING.html">Testing</a></nav>'
for src in sorted((ROOT/'docs').glob('*.md')):
 title=src.read_text().splitlines()[0].lstrip('# ')
 html=md.render(src.read_text()) if md else subprocess.run(['pandoc','-f','gfm','-t','html'],input=src.read_text(),text=True,capture_output=True,check=True).stdout
 html=re.sub(r'href="([^"#]+)\.md([#"]?)',r'href="\1.html\2',html)
 page=f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)} · Fitts Lab</title><style>{style}</style></head><body>{nav}<main>{html}<footer>Fitts Lab 1.0.6 · <a href="{src.name}">Markdown source</a></footer></main></body></html>'
 src.with_suffix('.html').write_text(page)
print('Generated formatted documentation.')
