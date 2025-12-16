import{A as b,W as g,j as d}from"./index-CkvKbGHG.js";import"./vendor-CMJYdXG8.js";const x=o=>{if(o==null)return"";const e=String(o);return/[",\n\r]/.test(e)?`"${e.replace(/"/g,'""')}"`:e},h=(o,e,t)=>{const s=Object.keys(e),r=[Object.values(e).join(",")];for(const a of o){const c=s.map(m=>x(a[m]));r.push(c.join(","))}const l=r.join(`
`),n=new Blob([`\uFEFF${l}`],{type:"text/csv;charset=utf-8;"});C(n,t)},p=o=>new Date(o).toLocaleDateString("pt-BR"),f=o=>{var i;let e,t,s;return(i=o.historicoPesagens)==null||i.forEach(r=>{r.type===g.Birth&&(e={weightKg:r.weightKg,date:r.date}),r.type===g.Weaning&&(t={weightKg:r.weightKg,date:r.date}),r.type===g.Yearling&&(s={weightKg:r.weightKg,date:r.date})}),{birth:e,weaning:t,yearling:s}},v=(o,e,t,s)=>{const i=new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"}),r=a=>{var c;return a?((c=t.find(m=>m.id===a))==null?void 0:c.name)||"Área desconhecida":"Sem área"};let n=`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${s.title}</title>
      
    <style>
      @page { size: A4; margin: 1.5cm; }
      * { box-sizing: border-box; }
      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 10px;
        line-height: 1.4;
        color: #333;
        margin: 0;
        padding: 0;
      }
      .header {
        text-align: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #381b18;
      }
      .header h1 {
        color: #381b18;
        margin: 0 0 5px 0;
        font-size: 22px;
      }
      .header .subtitle {
        color: #666;
        font-size: 12px;
        margin: 5px 0;
      }
      .header .date {
        color: #999;
        font-size: 10px;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 20px;
      }
      .stat-card {
        background: #f8f9fa;
        padding: 12px;
        border-radius: 6px;
        text-align: center;
        border: 1px solid #e9ecef;
      }
      .stat-card .value {
        font-size: 18px;
        font-weight: bold;
        color: #381b18;
      }
      .stat-card .label {
        font-size: 9px;
        color: #666;
        margin-top: 3px;
      }
      .section-title {
        font-size: 14px;
        font-weight: bold;
        color: #381b18;
        margin: 20px 0 10px 0;
        padding-bottom: 5px;
        border-bottom: 1px solid #ddd;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
        font-size: 9px;
      }
      th {
        background: #381b18;
        color: white;
        padding: 8px 6px;
        text-align: left;
        font-weight: 600;
      }
      td {
        padding: 6px;
        border-bottom: 1px solid #eee;
      }
      tr:nth-child(even) { background: #f9f9f9; }
      tr:hover { background: #f0f0f0; }
      .status-ativo { color: #28a745; font-weight: bold; }
      .status-vendido { color: #ffc107; font-weight: bold; }
      .status-obito { color: #dc3545; font-weight: bold; }
      .footer {
        margin-top: 30px;
        padding-top: 15px;
        border-top: 1px solid #ddd;
        font-size: 8px;
        color: #999;
        text-align: center;
      }
      .distribution-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 15px;
        margin-bottom: 20px;
      }
      .distribution-card {
        background: #f8f9fa;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid #e9ecef;
      }
      .distribution-card h4 {
        margin: 0 0 10px 0;
        font-size: 11px;
        color: #381b18;
      }
      .distribution-item {
        display: flex;
        justify-content: space-between;
        padding: 3px 0;
        border-bottom: 1px dotted #ddd;
      }
      .distribution-item:last-child { border: none; }
      @media print {
        .no-print { display: none; }
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    </style>
  
    </head>
    <body>
      <div class="header">
        <h1>${s.title}</h1>
        ${s.subtitle?`<div class="subtitle">${s.subtitle}</div>`:""}
        ${`<div class="date">Gerado em: ${i}</div>`}
      </div>
  `;return n+=`
      <div class="stats-grid">
        <div class="stat-card">
          <div class="value">${e.totalAnimals}</div>
          <div class="label">Total de Animais</div>
        </div>
        <div class="stat-card">
          <div class="value">${e.activeCount}</div>
          <div class="label">Ativos</div>
        </div>
        <div class="stat-card">
          <div class="value">${e.averageWeight.toFixed(1)} kg</div>
          <div class="label">Peso Médio</div>
        </div>
        <div class="stat-card">
          <div class="value">${e.maleCount}M / ${e.femaleCount}F</div>
          <div class="label">Machos / Fêmeas</div>
        </div>
      </div>

      <div class="distribution-grid">
        <div class="distribution-card">
          <h4>Distribuição por Raça</h4>
          ${Object.entries(e.breedDistribution).sort(([,a],[,c])=>c-a).map(([a,c])=>`
              <div class="distribution-item">
                <span>${a}</span>
                <strong>${c}</strong>
              </div>
            `).join("")}
        </div>
        <div class="distribution-card">
          <h4>Distribuição por Idade</h4>
          <div class="distribution-item">
            <span>Bezerros (0-6m)</span>
            <strong>${e.ageDistribution.bezerros}</strong>
          </div>
          <div class="distribution-item">
            <span>Jovens (6-12m)</span>
            <strong>${e.ageDistribution.jovens}</strong>
          </div>
          <div class="distribution-item">
            <span>Novilhos (12-24m)</span>
            <strong>${e.ageDistribution.novilhos}</strong>
          </div>
          <div class="distribution-item">
            <span>Adultos (24m+)</span>
            <strong>${e.ageDistribution.adultos}</strong>
          </div>
        </div>
      </div>
    `,n+=`
    <div class="section-title">Lista de Animais (${o.length})</div>
    <table>
      <thead>
        <tr>
          <th>Brinco</th>
          <th>Nome</th>
          <th>Raça</th>
          <th>Sexo</th>
          <th>Nascimento</th>
          <th>Peso (kg)</th>
          <th>Status</th>
          <th>Área</th>
          <th>Mãe</th>
          <th>Pai</th>
        </tr>
      </thead>
      <tbody>
  `,o.forEach(a=>{const c=a.status==="Ativo"?"status-ativo":a.status==="Vendido"?"status-vendido":"status-obito";n+=`
      <tr>
        <td><strong>${a.brinco}</strong></td>
        <td>${a.nome||"-"}</td>
        <td>${a.raca}</td>
        <td>${a.sexo}</td>
        <td>${p(a.dataNascimento)}</td>
        <td>${a.pesoKg}</td>
        <td class="${c}">${a.status}</td>
        <td>${r(a.managementAreaId)}</td>
        <td>${a.maeNome||"-"}</td>
        <td>${a.paiNome||"-"}</td>
      </tr>
    `}),n+=`
      </tbody>
    </table>
    <div class="footer">
      Fazenda+ - Sistema de Gestão de Rebanho • Relatório gerado automaticamente
    </div>
    </body>
    </html>
  `,n},N=(o,e,t,s)=>{const i=v(o,e,t,s),r=window.open("","_blank");if(!r){alert("Popup bloqueado! Permita popups para gerar o PDF.");return}r.document.write(i),r.document.close(),r.onload=()=>{setTimeout(()=>{r.print()},250)}},$=(o,e)=>{var t;return e?((t=o.find(s=>s.id===e))==null?void 0:t.name)||"Área desconhecida":"Sem área"},w=o=>{if(!o)return 1/0;const e=new Date(o),t=new Date;return(t.getFullYear()-e.getFullYear())*12+(t.getMonth()-e.getMonth())},S=o=>{var e;return(e=o.historicoPesagens)==null?void 0:e.some(t=>t.type===g.Birth||t.type===g.Weaning||t.type===g.Yearling)},D=o=>{const e=w(o.dataNascimento)<=18,t=!!(o.maeNome||o.maeRaca);return o.status!==b.Obito&&e&&(t||S(o))},u=(o,e)=>o.filter(D).map(t=>{const{birth:s,weaning:i,yearling:r}=f(t);return{brinco:t.brinco,nome:t.nome||"",sexo:t.sexo,raca:t.raca,status:t.status,dataNascimento:t.dataNascimento?p(t.dataNascimento):"",maeNome:t.maeNome||"",maeRaca:t.maeRaca||"",area:$(e,t.managementAreaId),pesoNascimentoKg:(s==null?void 0:s.weightKg)??"",dataPesoNascimento:s?p(s.date):"",pesoDesmameKg:(i==null?void 0:i.weightKg)??"",dataDesmame:i?p(i.date):"",pesoSobreanoKg:(r==null?void 0:r.weightKg)??"",dataSobreano:r?p(r.date):"",pesoAtualKg:t.pesoKg}}).filter(t=>t.maeNome||t.pesoNascimentoKg||t.pesoDesmameKg||t.pesoSobreanoKg).sort((t,s)=>(t.dataNascimento||"").localeCompare(s.dataNascimento||"")),P={brinco:"Brinco",nome:"Nome",sexo:"Sexo",raca:"Raça",status:"Status",area:"Área",dataNascimento:"Nascimento",maeNome:"Mãe",maeRaca:"Raça da Mãe",pesoNascimentoKg:"Peso Nasc. (kg)",dataPesoNascimento:"Data Nasc.",pesoDesmameKg:"Peso Desmame (kg)",dataDesmame:"Data Desmame",pesoSobreanoKg:"Peso Sobreano (kg)",dataSobreano:"Data Sobreano",pesoAtualKg:"Peso Atual (kg)"},A=(o,e,t=`terneiros_memoria_${new Date().toISOString().slice(0,10)}.csv`)=>{const s=u(o,e);if(s.length===0){alert("Nenhum terneiro com mãe ou pesos de desmame/sobreano para exportar. Ajuste os filtros.");return}h(s,P,t)},y=(o,e,t="Memória de Terneiros para Venda")=>{const s=u(o,e);if(s.length===0){alert("Nenhum terneiro com mãe ou pesos de desmame/sobreano para exportar. Ajuste os filtros.");return}const i=new Date().toLocaleDateString("pt-BR"),l=`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>${t}</title>
      
    <style>
      @page { size: A4; margin: 1.5cm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #222; }
      h1 { margin: 0; color: #381b18; font-size: 20px; }
      .header { text-align: center; margin-bottom: 16px; }
      .subtitle { color: #666; margin-top: 4px; font-size: 12px; }
      .note { background: #f8f9fa; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { background: #381b18; color: white; padding: 6px; text-align: left; font-weight: 600; }
      td { border-bottom: 1px solid #eee; padding: 6px; }
      tr:nth-child(even) { background: #fafafa; }
      .footer { margin-top: 16px; text-align: center; color: #888; font-size: 9px; }
    </style>
  
    </head>
    <body>
      <div class="header">
        <h1>${t}</h1>
        <div class="subtitle">${s.length} terneiros exportados • ${i}</div>
      </div>
      <div class="note">
        Relatório preparado para guardar o histórico de pesos (nascimento, desmame, sobreano) e genealogia materna antes da venda anual.
        Utilize os filtros da listagem para selecionar apenas os terneiros daquele ano antes de exportar.
      </div>
      <table>
        <thead>
          <tr>
            <th>Brinco</th>
            <th>Nome</th>
            <th>Sexo</th>
            <th>Raça</th>
            <th>Mãe</th>
            <th>Raça da Mãe</th>
            <th>Nascimento</th>
            <th>Peso Nasc. (kg)</th>
            <th>Peso Desmame (kg)</th>
            <th>Peso Sobreano (kg)</th>
            <th>Peso Atual (kg)</th>
            <th>Área</th>
          </tr>
        </thead>
        <tbody>
          ${s.map(a=>`
            <tr>
              <td><strong>${a.brinco}</strong></td>
              <td>${a.nome||"-"}</td>
              <td>${a.sexo}</td>
              <td>${a.raca}</td>
              <td>${a.maeNome||"-"}</td>
              <td>${a.maeRaca||"-"}</td>
              <td>${a.dataNascimento||"-"}</td>
              <td>${a.pesoNascimentoKg||"-"}</td>
              <td>${a.pesoDesmameKg||"-"}</td>
              <td>${a.pesoSobreanoKg||"-"}</td>
              <td>${a.pesoAtualKg||"-"}</td>
              <td>${a.area}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="footer">Fazenda+ • Relatório gerado automaticamente para memória de venda anual de terneiros</div>
    </body>
    </html>
  `,n=window.open("","_blank");if(!n){alert("Popup bloqueado! Permita popups para gerar o PDF.");return}n.document.write(l),n.document.close(),n.onload=()=>{setTimeout(()=>{n.print()},250)}},C=(o,e)=>{const t=document.createElement("a");if(t.download!==void 0){const s=URL.createObjectURL(o);t.setAttribute("href",s),t.setAttribute("download",e),t.style.visibility="hidden",document.body.appendChild(t),t.click(),document.body.removeChild(t),URL.revokeObjectURL(s)}},j=o=>o.map(e=>{var t,s,i;return{brinco:e.brinco,nome:e.nome||"",raca:e.raca,sexo:e.sexo,dataNascimento:e.dataNascimento?p(e.dataNascimento):"",pesoKg:e.pesoKg,status:e.status,paiNome:e.paiNome||"",maeNome:e.maeNome||"",numMedicacoes:e.historicoSanitario.length,numPesagens:e.historicoPesagens.length,numPrenhez:((t=e.historicoPrenhez)==null?void 0:t.length)||0,numAbortos:((s=e.historicoAborto)==null?void 0:s.length)||0,numProgenie:((i=e.historicoProgenie)==null?void 0:i.length)||0}}),R={brinco:"Brinco",nome:"Nome",raca:"Raça",sexo:"Sexo",dataNascimento:"Data de Nascimento",pesoKg:"Peso Atual (kg)",status:"Status",paiNome:"Pai",maeNome:"Mãe",numMedicacoes:"Nº Medicações",numPesagens:"Nº Pesagens",numPrenhez:"Nº Prenhez",numAbortos:"Nº Abortos",numProgenie:"Nº Crias"},z=({animals:o,stats:e,areas:t,variant:s="default"})=>{const i=()=>{const m=j(o);h(m,R,`animais_${new Date().toISOString().slice(0,10)}.csv`)},r=()=>{N(o,e,t,{title:"Relatório de Animais",subtitle:`${o.length} animais filtrados`})},l=()=>{A(o,t)},n=()=>{y(o,t)},a="px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors",c=s==="compact"?"grid grid-cols-2 gap-2 w-full":"flex gap-2";return d.jsxs("div",{className:c,children:[d.jsxs("button",{onClick:i,className:`${a} bg-green-600 hover:bg-green-700 text-white`,children:[d.jsx("span",{children:"📊"}),d.jsx("span",{children:"CSV"})]}),d.jsxs("button",{onClick:r,className:`${a} bg-red-600 hover:bg-red-700 text-white`,children:[d.jsx("span",{children:"📄"}),d.jsx("span",{children:"PDF"})]}),d.jsxs("button",{onClick:l,className:`${a} bg-amber-600 hover:bg-amber-700 text-white`,title:"Exporta somente terneiros com pesos de desmame/sobreano e genealogia materna para arquivar antes da venda",children:[d.jsx("span",{children:"🍼"}),d.jsx("span",{children:"Terneiros CSV"})]}),d.jsxs("button",{onClick:n,className:`${a} bg-amber-700 hover:bg-amber-800 text-white`,title:"Gera PDF com pesos por fase e mãe para arquivar antes da venda anual",children:[d.jsx("span",{children:"📔"}),d.jsx("span",{children:"Terneiros PDF"})]})]})};export{z as default};
