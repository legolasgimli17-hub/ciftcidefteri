function decodeHtml(s){return String(s||'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function text(s){return decodeHtml(String(s||'').replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());}
function trNumber(s){const v=String(s||'').replace(/[^0-9.,-]/g,'').trim();if(!v)return NaN;if(v.includes(','))return Number(v.replace(/\./g,'').replace(',','.'));const parts=v.split('.');return Number(parts.length===2&&parts[1].length===3?v:v.replace(/\./g,''));}
function isoDate(s){const m=String(s||'').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';}
async function fetchText(url,timeout=8000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':'EkinCep/1.1','Accept':'text/html,application/xhtml+xml'}});if(!r.ok)throw new Error('http_'+r.status);const body=await r.text();if(body.length>2_500_000)throw new Error('response_too_large');return body;}finally{clearTimeout(t);}}
function parseGtb(html){
  const report=(html.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*Salon\s+Satış\s+Fiyatları/i)||[])[1]||'';
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const items=[];
  for(const row of rows){
    const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>text(x[1])).filter(Boolean);
    if(cells.length<3)continue;
    const name=cells[0].trim(),low=trNumber(cells[1]),high=trNumber(cells[2]);
    if(!name||!Number.isFinite(low)||!Number.isFinite(high)||low<=0||high<=0||high<low)continue;
    items.push({name,exchange:'Gaziantep Ticaret Borsası',low,high,avg:Math.round(((low+high)/2)*1000)/1000,unit:'kg',date:isoDate(report),priceType:'salon_range_midpoint'});
  }
  return items;
}
function wantedCrop(name){return /BUĞDAY|ARPA|MISIR|MİSIR|AYÇİÇEĞİ|PAMUK|NOHUT|MERCİMEK|FASULYE|ÇELTİK|YULAF|ÇAVDAR|ZEYTİN|ANTEP FISTIĞI|FISTIK/i.test(name||'');}
module.exports=async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=21600');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end();}
  if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'method_not_allowed'}));}
  try{
    const html=await fetchText('https://www.gtb.org.tr/salon-satis-fiyatlari');
    let items=parseGtb(html).filter(x=>wantedCrop(x.name));
    const q=String(req.query?.q||'').trim().toLocaleUpperCase('tr');
    if(q)items=items.filter(x=>x.name.toLocaleUpperCase('tr').includes(q));
    items=items.slice(0,100);
    if(!items.length)throw new Error('parse_empty');
    res.end(JSON.stringify({
      source:'Gaziantep Ticaret Borsası Salon Satış Fiyatları',
      sourceUrl:'https://www.gtb.org.tr/salon-satis-fiyatlari',
      updatedAt:new Date().toISOString(),
      reportDate:items.find(x=>x.date)?.date||'',
      note:'GTB tarafından yayınlanan en az/en çok salon satış aralığının orta noktası uygulamada referans değer olarak gösterilir.',
      items
    }));
  }catch(e){
    res.statusCode=502;
    res.end(JSON.stringify({error:'market_unavailable',detail:e.message||'unavailable',source:'GTB'}));
  }
};