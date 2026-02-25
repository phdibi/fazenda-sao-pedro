# RELATÓRIO COMERCIAL COMPLETO
# Sistema de Gestão Pecuária - Fazenda São Pedro

**Versão do Documento:** 1.0
**Data:** 25 de fevereiro de 2026
**Classificação:** Confidencial - Uso Comercial

---

## SUMÁRIO EXECUTIVO

O **Sistema Fazenda São Pedro** é uma plataforma completa de gestão pecuária digital, desenvolvida sob medida para fazendas de gado de corte e cria. A aplicação centraliza toda a operação da fazenda em um único ambiente digital: desde o controle individual de cada animal, passando pela gestão reprodutiva avançada com suporte a FIV, IATF, IA e monta natural, até análises genéticas (DEP), KPIs zootécnicos em tempo real e relatórios inteligentes com IA.

Trata-se de um sistema **enterprise-grade** com arquitetura offline-first, sincronização em tempo real, controle de acesso por perfis e infraestrutura escalável em nuvem, pronto para operar com rebanhos de qualquer porte.

---

## PARTE 1 - INVENTÁRIO COMPLETO DE FUNCIONALIDADES

---

### 1. GESTÃO DE REBANHO (Cadastro e Controle Individual)

| Funcionalidade | Descrição |
|---|---|
| **Cadastro completo de animais** | Brinco, nome, raça (Hereford, Braford, Hereford PO, Outros), sexo, data de nascimento, peso, status (Ativo/Vendido/Óbito) |
| **Fotos com recorte inteligente** | Upload de fotos com editor de recorte integrado, compressão automática para WebP, thumbnail otimizado |
| **Genealogia completa** | Vínculo de pai e mãe por ID ou nome, árvore genealógica visual com ascendentes e descendentes |
| **FIV - Dupla maternidade** | Registro separado de mãe biológica (doadora) e mãe gestacional (receptora) |
| **Filtros avançados** | Busca por brinco, nome, pai, mãe, medicamento, motivo. Filtros por raça, sexo, status, área, faixa de peso e idade |
| **Ordenação múltipla** | Por brinco, nome, peso, data de nascimento, raça, status |
| **Operadores booleanos** | Busca com "ou" (OR) e "e" (AND) para localização rápida |
| **Grid virtualizado** | Renderização otimizada para rebanhos com milhares de cabeças |
| **Ações rápidas (swipe)** | Deslize para direita = peso rápido. Deslize para esquerda = medicação rápida |
| **Arquivamento e exclusão** | Soft delete (arquivar) e hard delete com confirmação |

---

### 2. CONTROLE SANITÁRIO

| Funcionalidade | Descrição |
|---|---|
| **Histórico sanitário completo** | Registro de cada aplicação com data, responsável, motivo e múltiplos medicamentos por evento |
| **Múltiplos medicamentos por aplicação** | Cada tratamento pode incluir N medicamentos com dose e unidade (ml/mg/dose) |
| **Medicações predefinidas** | Acesso rápido: Ivermectina, Doramectina, Vacina Aftosa, Vacina Carbúnculo |
| **Motivos categorizados** | Vacinação, Vermifugação, Banho, Protocolo Cio, Outro |
| **Comando por voz** | Integração com reconhecimento de fala + IA (Gemini) para preencher fichas sanitárias por voz |
| **Relatório sanitário com IA** | Análise inteligente de padrões sanitários, medicamentos mais usados, animais mais tratados, sazonalidade |

---

### 3. CONTROLE DE PESAGENS

| Funcionalidade | Descrição |
|---|---|
| **Histórico de pesagens** | Registro de peso com data e classificação automática (Nascimento, Desmame, Sobreano, Peso de Virada) |
| **Classificação automática por idade** | O sistema atribui o tipo de pesagem com base na idade do animal |
| **GMD (Ganho Médio Diário)** | Cálculo automático: total, recente, por período (nascimento-desmame, desmame-sobreano, últimos 30 dias) |
| **Importação de balança digital** | Importa CSV de balanças Tru-Test (formato ponto-e-vírgula), match automático por brinco |
| **Predição de peso** | Projeção de peso futuro baseada no GMD histórico com intervalo de confiança |
| **Ranking de desempenho** | Classificação de animais por GMD dentro do rebanho e dentro da raça |

---

### 4. GESTÃO REPRODUTIVA (Estação de Monta)

| Funcionalidade | Descrição |
|---|---|
| **Estações de Monta** | Criar, editar, finalizar estações com datas, touros, vacas expostas e configurações |
| **4 tipos de cobertura** | Monta Natural (1-2 touros), IA (Inseminação Artificial), IATF (Inseminação em Tempo Fixo), FIV (Fertilização In Vitro) |
| **Registro de coberturas** | Vaca, touro(s), data, tipo, técnico, observações. Suporte a 2 touros por cobertura natural |
| **FIV completo** | Registro de doadora (mãe genética) e receptora (mãe gestacional) com código do sêmen |
| **Diagnóstico de Gestação (DG)** | Registro de DG positivo/negativo com dias configuráveis (padrão 60 dias) |
| **Repasse automático** | Vacas com DG negativo em IATF/FIV/IA são direcionadas automaticamente para repasse por monta natural |
| **Repasse com 2 touros** | Suporte a repasse com 1 ou 2 touros, com confirmação de paternidade posterior |
| **Confirmação de paternidade** | Modal avançado com: data de troca de touro, seleção direta, aplicação em lote |
| **BullSwitchConfig** | Configuração de data de troca de touro para confirmação automática de paternidade |
| **Verificação de partos** | Detecção automática de bezerros nascidos, vinculação à cobertura, registro de abortos para partos atrasados |
| **Registro de abortos** | Detecção automática (>30 dias de atraso) e registro manual com notas |
| **Alertas de parto tardio** | Notificação para IATF/FIV com partos >30 dias além do esperado |
| **Lista de Vazias** | Visualização de vacas com DG negativo final (sem prenhez) |
| **Cálculo de data prevista** | Data de cobertura + 283 dias (gestação bovina) = data prevista do parto |

**Métricas em tempo real da Estação:**
- Taxa de Serviço (Cobertas / Expostas)
- Taxa de Concepção (Prenhes / Cobertas)
- Taxa de Prenhez (1o serviço e geral)
- Coberturas por tipo (IATF, FIV, IA, Natural)
- Desempenho por touro/sêmen
- Estatísticas de repasse

---

### 5. ANÁLISE GENÉTICA (DEP)

| Funcionalidade | Descrição |
|---|---|
| **DEP - Diferença Esperada na Progênie** | Cálculo de valores genéticos para cada animal |
| **DEPs de Peso** | Peso ao Nascimento, Peso à Desmama, Peso ao Sobreano (kg) |
| **DEPs Maternos** | Produção de Leite, Habilidade Materna Total (kg) |
| **DEPs de Carcaça** | Área de Olho de Lombo (cm²), Espessura de Gordura (mm) |
| **DEPs de Fertilidade** | Circunferência Escrotal (cm), Stayability (%) |
| **Acurácia** | Confiabilidade do DEP baseada em registros próprios, progênie e irmãos |
| **Percentil** | Posição do animal dentro da distribuição genética do rebanho |
| **Recomendação genética** | Classificação: Reprodutor Elite, Reprodutor, Descarte, Matriz Elite, Matriz, Indefinido |
| **Baseline por raça** | Média e desvio padrão da população por raça para comparação |

---

### 6. KPIs ZOOTÉCNICOS

| KPI | Unidade | Meta Padrão |
|---|---|---|
| Taxa de Prenhez | % | 80% |
| Taxa de Natalidade | % | 90% |
| Taxa de Mortalidade | % | 3% |
| Intervalo entre Partos | dias | 365 dias |
| Peso Médio ao Nascimento | kg | 33 kg |
| Peso Médio à Desmama | kg | 200 kg |
| Peso Médio ao Sobreano | kg | 320 kg |
| GMD Médio | kg/dia | 0.7 kg/dia |
| Kg de Bezerro/Vaca/Ano | kg | 160 kg |

- Indicadores visuais: Excelente / Bom / Atenção / Crítico
- Barras de progresso contra metas
- Composição do rebanho em tempo real

---

### 7. RELATÓRIOS INTELIGENTES COM IA

| Relatório | Conteúdo |
|---|---|
| **Análise Sanitária** | Padrões de medicação, sazonalidade, animais mais tratados, recomendações da IA |
| **Análise Reprodutiva** | Desempenho de matrizes, taxas por tipo de cobertura, eficiência reprodutiva |
| **Peso de Virada** | Análise de peso por raça, top performers, benchmarks |
| **Comparativos** | Comparação entre grupos, correlação clima x desempenho |
| **Análise Fenotípica** | Avaliação de características físicas e aptidão reprodutiva |
| **DEP Genético** | Relatório completo de valores genéticos estimados |

Todos os relatórios incluem:
- Geração por IA (Google Gemini)
- Filtro por período
- Exportação PDF
- Recomendações personalizadas

---

### 8. GESTÃO DE ÁREAS E PASTAGENS

| Funcionalidade | Descrição |
|---|---|
| **Áreas de manejo** | Cadastro de piquetes/pastagens com nome e área em hectares |
| **Alocação de animais** | Interface dual-column para mover animais entre áreas |
| **Métricas por área** | Nº de animais, peso vivo total, densidade (kg/ha) |
| **Alerta de superlotação** | Indicador visual quando kg/ha > 500 |
| **Busca por animal** | Localizar animal por brinco ou nome dentro das áreas |

---

### 9. GESTÃO DE LOTES E OPERAÇÕES EM MASSA

| Funcionalidade | Descrição |
|---|---|
| **Lotes de manejo** | Criar lotes por propósito: Vacinação, Vermifugação, Pesagem, Venda, Desmame, Confinamento, etc. |
| **Pesagem em lote** | Registrar pesos de múltiplos animais de uma vez |
| **Medicação em lote** | Aplicar tratamento sanitário a todo o lote |
| **Importação de balança** | CSV de balança digital com match automático |
| **Status do lote** | Ativo, Concluído, Arquivado |
| **Histórico** | Últimos 10 lotes concluídos com data e resultados |

---

### 10. AGENDA E TAREFAS

| Funcionalidade | Descrição |
|---|---|
| **Calendário mensal** | Visualização de eventos por mês com navegação |
| **3 tipos de evento** | Evento (azul), Observação (amarelo), Compromisso (verde) |
| **Tarefas** | Lista de tarefas com prazo e status de conclusão |
| **Ordenação** | Tarefas ordenadas por prazo (mais urgentes primeiro) |
| **Separação visual** | Pendentes vs. Concluídas |

---

### 11. GENEALOGIA VISUAL

| Funcionalidade | Descrição |
|---|---|
| **Árvore de ancestrais** | Visualização de linhagem paterna e materna |
| **Dashboard de descendentes** | Análise de performance dos filhos |
| **Grid de progênie** | Filhos agrupados por pai (touro) |
| **Conectores visuais** | Linhas SVG conectando gerações |
| **Legenda** | Código de cores por status e classificação |

---

### 12. INFRAESTRUTURA TÉCNICA AVANÇADA

| Recurso | Descrição |
|---|---|
| **Offline-first** | Funciona sem internet. Fila de operações offline com retry automático |
| **Sincronização em tempo real** | Firebase Firestore listeners para atualizações instantâneas |
| **Delta Sync** | Sincroniza apenas documentos alterados desde última atualização |
| **Cache local** | IndexedDB com compressão LZ-string, TTL de 7 dias |
| **Stale-While-Revalidate** | Retorna cache imediatamente enquanto atualiza em background |
| **PWA (Progressive Web App)** | Service Worker para funcionamento offline e instalação |
| **Virtualização** | React-window para renderizar milhares de animais sem lag |
| **Paginação por cursor** | Carregamento progressivo de dados do Firestore |
| **Monitoramento de cota** | Controle de reads/writes do Firebase para não exceder limites |
| **Pausa por visibilidade** | Listeners pausam quando aba não está visível (~40% economia) |
| **Rate limiting** | Token bucket para controlar chamadas de API |
| **Updates otimistas** | UI atualiza instantaneamente, sync em background |
| **Compressão de imagens** | Redimensionamento e conversão para WebP automáticos |

---

### 13. CONTROLE DE ACESSO

| Perfil | Animais | Financeiro | Relatórios | Agenda | Tarefas | Gerenciar Usuários |
|---|---|---|---|---|---|---|
| **Proprietário** | Ver/Editar/Excluir | Sim | Sim | Sim | Sim | Sim |
| **Veterinário** | Ver/Editar | Não | Sim | Sim | Sim | Não |
| **Capataz** | Não | Não | Não | Sim | Sim | Não |
| **Funcionário** | Apenas Ver | Não | Não | Sim | Sim | Não |

---

### 14. INTELIGÊNCIA ARTIFICIAL

| Recurso | Tecnologia |
|---|---|
| **Relatórios inteligentes** | Google Gemini para análise e recomendações |
| **Comandos por voz** | Web Speech API + Gemini para preenchimento de fichas |
| **Chatbot integrado** | Assistente IA para consultas sobre o rebanho |
| **Predição de peso** | Modelo de regressão baseado no GMD histórico |
| **Recomendação genética** | Classificação automática baseada em DEP calculados |

---

### 15. EXPORTAÇÃO DE DADOS

| Formato | Conteúdo |
|---|---|
| **CSV** | Listagem de animais, estações de monta, pesagens, medicações |
| **PDF** | Relatórios formatados com gráficos e métricas |
| **Impressão** | Otimizado para impressão direta dos relatórios |

---

### 16. INTERFACE RESPONSIVA

| Dispositivo | Experiência |
|---|---|
| **Desktop** | Grid de 5-7 colunas, navegação horizontal completa |
| **Tablet** | Grid de 3-4 colunas, layout adaptado |
| **Celular** | Grid de 2 colunas, barra de navegação inferior, gestos de swipe |
| **PWA instalável** | Pode ser instalado como app no celular |

---

## PARTE 2 - PROPOSTA DE VALOR E JUSTIFICATIVA DE INVESTIMENTO

---

### POR QUE INVESTIR NESTE SISTEMA?

#### 1. Eliminação de perdas por falta de controle

**Sem o sistema:** O produtor perde em média 10-15% de eficiência reprodutiva por falta de controle de coberturas, diagnósticos atrasados e vacas vazias não identificadas.

**Com o sistema:** Cada vaca exposta é rastreada individualmente, DGs pendentes são alertados automaticamente, repasses são disparados automaticamente para vacas negativas, e a lista de vazias é gerada em tempo real.

**Impacto estimado:** Para um rebanho de 500 matrizes com bezerro valendo R$ 2.500, um aumento de 5% na taxa de prenhez representa **62 bezerros a mais = R$ 155.000/ano**.

#### 2. Decisões genéticas baseadas em dados

**Sem o sistema:** A seleção de reprodutores é feita visualmente ou por impressão subjetiva.

**Com o sistema:** DEP calculado automaticamente com acurácia por fonte de dados (próprio, progênie, irmãos), percentil no rebanho e recomendação automática (Reprodutor Elite, Matriz Elite, Descarte).

**Impacto:** Aumento médio de 3-5% no ganho genético anual do rebanho.

#### 3. Controle sanitário que previne surtos

**Sem o sistema:** Medicações são anotadas em cadernos, perdidas ou esquecidas. Padrões de doença passam despercebidos.

**Com o sistema:** Histórico sanitário completo por animal, análise de sazonalidade com IA, identificação de animais mais tratados, recomendações inteligentes.

**Impacto:** Redução de 20-30% em gastos com medicamentos por detecção precoce de padrões.

#### 4. Rastreabilidade completa para certificações

O sistema mantém toda a cadeia de informações exigida por programas como SISBOV, certificações de raça (ABHB, Herd-Book) e rastreabilidade para exportação.

#### 5. Operação ininterrupta com modo offline

A fazenda não para por falta de internet. Todo o sistema funciona offline com sincronização automática quando a conexão retorna.

#### 6. Economia de tempo operacional

| Tarefa | Sem sistema | Com sistema | Economia |
|---|---|---|---|
| Registrar pesagem de 100 animais | 2-3 horas (manual) | 15 min (importação de balança) | 85% |
| Verificar DGs pendentes | 30-60 min (caderno) | Instantâneo (aba automática) | 95% |
| Gerar relatório reprodutivo | 1-2 dias (planilha) | 30 segundos (IA) | 99% |
| Localizar animal | 10-30 min (memória) | 2 segundos (busca) | 99% |
| Calcular GMD do rebanho | 4-8 horas (calculadora) | Automático e em tempo real | 100% |

---

## PARTE 3 - TABELA DE CUSTOS POR TAMANHO DE REBANHO

---

### Custos de Infraestrutura (Firebase + Hospedagem)

#### Plano Spark (Gratuito) - até ~300 animais
| Item | Limite | Custo |
|---|---|---|
| Firestore Reads | 50.000/dia | R$ 0 |
| Firestore Writes | 20.000/dia | R$ 0 |
| Storage | 5 GB | R$ 0 |
| Hosting | 10 GB transfer | R$ 0 |
| **Total mensal** | | **R$ 0** |

#### Plano Blaze (Pay-as-you-go) - 300 a 2.000 animais
| Item | Estimativa (1.000 animais) | Custo/mês |
|---|---|---|
| Firestore Reads | ~200.000/dia | R$ 15 - 40 |
| Firestore Writes | ~5.000/dia | R$ 5 - 15 |
| Storage (fotos) | 10-30 GB | R$ 5 - 15 |
| Hosting | 50 GB transfer | R$ 5 - 10 |
| Gemini API (relatórios) | ~100 chamadas/mês | R$ 5 - 20 |
| **Total mensal** | | **R$ 35 - 100** |

#### Plano Blaze - 2.000 a 10.000 animais
| Item | Estimativa (5.000 animais) | Custo/mês |
|---|---|---|
| Firestore Reads | ~1.000.000/dia | R$ 80 - 200 |
| Firestore Writes | ~20.000/dia | R$ 20 - 50 |
| Storage (fotos) | 50-100 GB | R$ 20 - 50 |
| Hosting | 200 GB transfer | R$ 20 - 40 |
| Gemini API | ~500 chamadas/mês | R$ 20 - 50 |
| **Total mensal** | | **R$ 160 - 390** |

> **Nota:** O sistema possui otimizações agressivas (cache, delta sync, pausa de listeners, monitoramento de cota) que mantêm os custos do Firebase consideravelmente abaixo dos limites teóricos.

---

### Custos para Publicação como App Mobile (Android + iOS)

| Item | Custo Único | Custo Recorrente |
|---|---|---|
| Conta Google Play Developer | R$ 125 (taxa única) | R$ 0 |
| Conta Apple Developer | - | R$ 500/ano |
| Wrapper PWA → App (Capacitor/Ionic) | R$ 3.000 - 8.000* | - |
| OU Conversão nativa (React Native) | R$ 15.000 - 40.000* | - |
| Certificado SSL (já incluso Firebase) | R$ 0 | R$ 0 |
| Domínio personalizado | R$ 40 - 80/ano | - |

*\* Estimativa para terceirizar. Se incluído no pacote de venda, este custo é absorvido.*

---

## PARTE 4 - MODELO DE NEGÓCIO E ESTRATÉGIA DE VENDA

---

### Opção A: Licença Única + Manutenção Temporária (RECOMENDADO)

**Estrutura:**
1. **Taxa de licenciamento** (pagamento único): inclui implantação, configuração, treinamento
2. **Manutenção** por 3-6 meses após entrega (incluso no preço)
3. **Suporte estendido** (opcional): após período de manutenção, pacote mensal

**Vantagens:**
- Recebe valor significativo upfront
- Período de manutenção limitado e definido
- Após 3-6 meses, o cliente opera sozinho
- Sem vínculo permanente

**Tabela de preços sugeridos:**

| Tamanho do Rebanho | Licença Única | Manutenção Inclusa | Suporte Estendido (opcional) |
|---|---|---|---|
| Até 500 cabeças | R$ 25.000 - 40.000 | 3 meses | R$ 800/mês |
| 500 a 2.000 cabeças | R$ 40.000 - 70.000 | 6 meses | R$ 1.200/mês |
| 2.000 a 5.000 cabeças | R$ 70.000 - 120.000 | 6 meses | R$ 2.000/mês |
| Acima de 5.000 cabeças | R$ 120.000 - 200.000 | 12 meses | R$ 3.500/mês |

**O que está incluso na licença:**
- Deploy completo da aplicação no Firebase do cliente
- Configuração do domínio personalizado
- Publicação na Google Play e App Store
- Treinamento de operação (presencial ou remoto)
- Manual de uso completo
- Migração de dados existentes (se aplicável)
- Período de manutenção incluso

---

### Opção B: SaaS (Software as a Service)

**Estrutura:**
- Mensalidade recorrente
- Hospedagem centralizada (multi-tenant)
- Atualizações contínuas

| Plano | Rebanho | Mensal | Anual (com desconto) |
|---|---|---|---|
| Starter | Até 200 | R$ 350/mês | R$ 3.500/ano |
| Profissional | Até 1.000 | R$ 800/mês | R$ 8.000/ano |
| Enterprise | Até 5.000 | R$ 1.800/mês | R$ 18.000/ano |
| Personalizado | Ilimitado | Sob consulta | Sob consulta |

**Nota:** O modelo SaaS exige que você mantenha a infraestrutura. Se o objetivo é se desligar do cliente, **opte pela Opção A**.

---

## PARTE 5 - PROTEÇÃO JURÍDICA E PROPRIEDADE INTELECTUAL

---

### 5.1. Registro de Software no INPI

O software pode ser registrado no INPI (Instituto Nacional da Propriedade Industrial) como **programa de computador**, conforme a Lei nº 9.609/98 (Lei do Software).

**Procedimento:**
1. Acessar o sistema e-Software do INPI: https://www.gov.br/inpi/pt-br
2. Gerar hash SHA-512 ou MD5 do código-fonte completo
3. Preencher formulário com descrição funcional
4. Pagar taxa (GRU): aproximadamente R$ 185 (pessoa física) ou R$ 410 (empresa)
5. Prazo de proteção: **50 anos** a partir da data de publicação

**O que protege:**
- O código-fonte em si (expressão literária)
- A documentação técnica
- Não protege a ideia/funcionalidade (para isso seria necessária patente de modelo de utilidade, mais complexa)

**Recomendação:** Faça o registro ANTES de qualquer demonstração ou venda ao cliente.

---

### 5.2. Contrato de Licença de Uso (NÃO transferência de propriedade)

O contrato deve deixar claro que o cliente recebe uma **LICENÇA DE USO**, não a propriedade do software.

---

### 5.3. Modelo de Contrato

```
CONTRATO DE LICENÇA DE USO DE SOFTWARE
E PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: [Nome/Razão Social do Cliente], inscrito no CPF/CNPJ
sob nº [xxx], com sede em [endereço], doravante denominado LICENCIADO.

CONTRATADO: [Seu Nome/Razão Social], inscrito no CPF/CNPJ sob nº [xxx],
com sede em [endereço], doravante denominado LICENCIANTE.

As partes acima qualificadas celebram o presente contrato, que se
regerá pelas seguintes cláusulas e condições:

---

CLÁUSULA 1ª - DO OBJETO

1.1. O presente contrato tem por objeto a concessão de LICENÇA DE USO,
em caráter não exclusivo e intransferível, do software "Sistema de
Gestão Pecuária Fazenda São Pedro" (doravante "SOFTWARE"), incluindo
a implantação, configuração, treinamento e manutenção temporária,
conforme especificações do Anexo I.

1.2. O SOFTWARE é de propriedade exclusiva do LICENCIANTE, protegido
pela Lei nº 9.609/98 (Lei do Software) e registrado no INPI sob nº
[incluir após registro].

---

CLÁUSULA 2ª - DA LICENÇA

2.1. A licença concedida é de uso PESSOAL e INTRANSFERÍVEL, limitada
à operação pecuária do LICENCIADO nas propriedades declaradas no
Anexo II.

2.2. O LICENCIADO NÃO poderá:
  a) Sublicenciar, ceder, alugar, emprestar ou transferir o SOFTWARE
     a terceiros, total ou parcialmente;
  b) Copiar, reproduzir, modificar, adaptar ou criar obras derivadas
     do SOFTWARE;
  c) Descompilar, fazer engenharia reversa, desmontar ou tentar
     derivar o código-fonte do SOFTWARE;
  d) Comercializar, revender, distribuir ou disponibilizar o SOFTWARE
     a terceiros sob qualquer forma;
  e) Utilizar o SOFTWARE para prestar serviços a terceiros;
  f) Remover ou alterar avisos de propriedade intelectual.

---

CLÁUSULA 3ª - DO PREÇO E FORMA DE PAGAMENTO

3.1. Pela licença de uso, implantação, configuração, treinamento e
manutenção temporária, o LICENCIADO pagará ao LICENCIANTE o valor
total de R$ [VALOR] ([valor por extenso]).

3.2. O pagamento será realizado da seguinte forma:
  a) [50%] na assinatura deste contrato: R$ [valor]
  b) [30%] na entrega e deploy do sistema: R$ [valor]
  c) [20%] ao final do período de manutenção: R$ [valor]

3.3. Em caso de inadimplência, incidirão juros de 1% ao mês e multa
de 2% sobre o valor devido, sem prejuízo da suspensão imediata do
suporte técnico.

---

CLÁUSULA 4ª - DA IMPLANTAÇÃO E ENTREGA

4.1. O LICENCIANTE realizará:
  a) Deploy completo da aplicação na infraestrutura Firebase do
     LICENCIADO;
  b) Configuração do domínio personalizado e certificados;
  c) Publicação nas lojas de aplicativos (Google Play e Apple App
     Store);
  d) Migração de dados existentes, se aplicável;
  e) Treinamento de operação para até [X] usuários;
  f) Entrega de manual de operação completo.

4.2. O prazo de implantação será de [30-60] dias a contar da
assinatura deste contrato.

---

CLÁUSULA 5ª - DA MANUTENÇÃO

5.1. O LICENCIANTE prestará manutenção corretiva do SOFTWARE pelo
período de [3/6/12] meses a contar da data de entrega, incluindo:
  a) Correção de bugs e falhas de funcionamento;
  b) Suporte técnico por e-mail/WhatsApp em horário comercial;
  c) Atualizações de segurança.

5.2. NÃO estão incluídos na manutenção:
  a) Desenvolvimento de novas funcionalidades;
  b) Alterações no layout ou design;
  c) Suporte a hardware (balanças, computadores, etc.);
  d) Custos de infraestrutura Firebase (responsabilidade do
     LICENCIADO).

5.3. Após o período de manutenção, o LICENCIADO poderá contratar
pacote de suporte estendido conforme tabela do Anexo III, ou
operar o sistema de forma independente.

---

CLÁUSULA 6ª - DA PROPRIEDADE INTELECTUAL

6.1. O SOFTWARE, incluindo seu código-fonte, design, arquitetura,
documentação técnica, algoritmos e bases de dados, é e permanecerá
sendo de propriedade exclusiva do LICENCIANTE.

6.2. Os dados inseridos pelo LICENCIADO no SOFTWARE são de propriedade
do LICENCIADO, que poderá exportá-los a qualquer momento nos formatos
disponíveis (CSV, PDF).

6.3. A celebração deste contrato NÃO implica transferência de
propriedade intelectual, direitos autorais ou quaisquer outros
direitos sobre o SOFTWARE, além da licença de uso aqui concedida.

---

CLÁUSULA 7ª - DA CLÁUSULA DE NÃO COMERCIALIZAÇÃO (MULTA)

7.1. É EXPRESSAMENTE VEDADO ao LICENCIADO comercializar, revender,
sublicenciar, distribuir, transferir ou disponibilizar o SOFTWARE
a terceiros, sob qualquer forma, meio ou pretexto.

7.2. A violação da cláusula 7.1 sujeitará o LICENCIADO ao
pagamento de multa no valor de R$ [VALOR DA MULTA - sugestão:
10x o valor da licença], sem prejuízo de:
  a) Indenização por perdas e danos, incluindo lucros cessantes;
  b) Revogação imediata da licença de uso;
  c) Medidas judiciais cabíveis, incluindo ação de busca e
     apreensão e tutela de urgência;
  d) Responsabilização criminal nos termos do Art. 12 da Lei
     9.609/98 (pena de detenção de 6 meses a 2 anos e multa).

7.3. A multa prevista nesta cláusula é cumulativa e não
compensatória, podendo ser cobrada simultaneamente com eventuais
indenizações por perdas e danos.

---

CLÁUSULA 8ª - DA CONFIDENCIALIDADE

8.1. O LICENCIADO compromete-se a manter sigilo sobre quaisquer
informações técnicas do SOFTWARE a que tenha acesso, incluindo
arquitetura, funcionalidades internas e documentação técnica.

8.2. A obrigação de confidencialidade perdurará por 5 (cinco)
anos após o término deste contrato.

---

CLÁUSULA 9ª - DAS OBRIGAÇÕES DO LICENCIADO

9.1. São obrigações do LICENCIADO:
  a) Manter a conta Firebase ativa e com créditos suficientes;
  b) Manter a conta Apple Developer ativa (renovação anual);
  c) Não realizar alterações no código-fonte ou configurações
     técnicas sem autorização;
  d) Notificar o LICENCIANTE imediatamente sobre qualquer
     irregularidade ou uso não autorizado;
  e) Manter backups regulares dos dados.

---

CLÁUSULA 10ª - DA RESCISÃO

10.1. Este contrato poderá ser rescindido:
  a) Por mútuo acordo entre as partes;
  b) Por inadimplência de qualquer das partes, após notificação
     com prazo de 30 dias para regularização;
  c) Por violação das cláusulas de propriedade intelectual ou
     não comercialização (rescisão imediata).

10.2. Em caso de rescisão, o LICENCIADO deverá cessar
imediatamente o uso do SOFTWARE. Os dados do LICENCIADO
serão disponibilizados para exportação pelo prazo de 30 dias.

---

CLÁUSULA 11ª - DAS DISPOSIÇÕES GERAIS

11.1. O presente contrato é regido pelas leis da República
Federativa do Brasil, em especial a Lei nº 9.609/98 e a Lei
nº 9.610/98.

11.2. Eventuais litígios serão dirimidos no Foro da Comarca
de [sua cidade], com exclusão de qualquer outro.

11.3. Este contrato constitui o acordo integral entre as
partes, substituindo quaisquer acordos anteriores verbais
ou escritos.

---

Local e data: [Cidade], [dia] de [mês] de [ano].

________________________________
LICENCIANTE
[Nome completo]
[CPF/CNPJ]

________________________________
LICENCIADO
[Nome completo]
[CPF/CNPJ]

Testemunhas:

1. ______________________________
   Nome:
   CPF:

2. ______________________________
   Nome:
   CPF:
```

---

### 5.4. Medidas de Proteção Técnica Adicionais

| Medida | Implementação | Proteção |
|---|---|---|
| **Código ofuscado** | Build minificado do Vite (já padrão) | Dificulta leitura do código |
| **Firebase Rules** | Regras de segurança por userId | Isola dados por usuário |
| **Sem acesso ao código-fonte** | Deploy apenas do build (dist/) | Cliente não recebe o source |
| **Licença embarcada** | Adicionar verificação de licença no app | Impede uso não autorizado |
| **Registro INPI** | Hash do código-fonte registrado | Prova de autoria legal |
| **Contrato com multa** | Cláusula 7ª acima | Desincentivo financeiro |

---

## PARTE 6 - CHECKLIST DE ENTREGA AO CLIENTE

---

### O que entregar:

- [ ] Aplicação deployada no Firebase do cliente
- [ ] Domínio personalizado configurado (ex: gestao.fazendacliente.com.br)
- [ ] App publicado na Google Play Store
- [ ] App publicado na Apple App Store
- [ ] Manual de operação (PDF)
- [ ] Treinamento presencial ou por videoconferência
- [ ] Credenciais de acesso do proprietário
- [ ] Configuração de perfis de usuário (capataz, veterinário, etc.)
- [ ] Migração de dados existentes (se aplicável)
- [ ] Contrato assinado com cláusula de não revenda
- [ ] Registro no INPI (comprovante)

### O que NÃO entregar:

- [ ] Código-fonte
- [ ] Acesso ao repositório Git
- [ ] Documentação técnica/arquitetural
- [ ] Credenciais de desenvolvimento
- [ ] Acesso à conta Gemini API (usar conta do cliente com chave configurada)

---

## PARTE 7 - COMO ABORDAR A VENDA

---

### Roteiro de Apresentação Comercial

**1. Abertura (5 min):**
"Quanto custa uma vaca vazia no seu rebanho? Se cada bezerro desmamado vale R$ 2.500 e você tem 10% de vacas vazias que poderiam ser identificadas mais cedo..."

**2. Demonstração do Problema (10 min):**
- Mostrar cenário de fazenda sem controle digital
- Quantificar perdas por falta de rastreabilidade reprodutiva
- Mencionar exigências de certificação e rastreabilidade

**3. Demonstração do Sistema (20 min):**
- Mostrar cadastro rápido de animal (2 cliques)
- Demonstrar importação de balança (15 segundos para 100 animais)
- Mostrar estação de monta com DGs pendentes
- Exibir KPIs em tempo real
- Gerar relatório com IA na hora

**4. ROI (10 min):**
- Para 500 matrizes: aumento de 5% na taxa de prenhez = +25 bezerros = +R$ 62.500/ano
- Para 1.000 matrizes: = +50 bezerros = +R$ 125.000/ano
- Economia operacional: 10-20 horas/semana de trabalho manual eliminado
- O investimento se paga em **2-4 meses**

**5. Fechamento (10 min):**
- Apresentar proposta comercial
- Oferecer período de demonstração (7 dias)
- Pagamento parcelado no modelo 50/30/20
- Depoimento de uso na própria fazenda como case de sucesso

---

### Argumentos para Objeções Comuns

| Objeção | Resposta |
|---|---|
| "É muito caro" | "Quanto você perde por ano com vacas vazias não identificadas? O sistema se paga em 2-4 meses." |
| "Já uso planilha" | "Planilha não calcula DEP, não faz DG automático, não funciona offline no curral e não gera relatório com IA." |
| "Não tenho internet na fazenda" | "O sistema funciona 100% offline. Sincroniza quando tiver sinal." |
| "E se eu precisar de suporte depois?" | "Incluímos X meses de manutenção. Depois, há pacote opcional ou você opera sozinho com o manual." |
| "Posso contratar um programador mais barato" | "Este sistema tem mais de 180 arquivos de código, 400+ tipos de dados e 2 anos de desenvolvimento. Recriar custaria 5-10x mais." |
| "E os custos de servidor?" | "Para até 300 animais, o custo é ZERO (plano gratuito do Firebase). Acima disso, R$ 35-100/mês." |

---

## PARTE 8 - ESPECIFICAÇÃO TÉCNICA DO SOFTWARE

---

### Ficha Técnica

| Item | Especificação |
|---|---|
| **Nome** | Sistema de Gestão Pecuária Fazenda São Pedro |
| **Versão** | 1.0 |
| **Tecnologias** | React 18, TypeScript, Vite, Firebase (Auth, Firestore, Storage, Hosting), Tailwind CSS |
| **IA** | Google Gemini API (relatórios e comandos de voz) |
| **Plataformas** | Web (PWA), Android (via Capacitor/TWA), iOS (via Capacitor) |
| **Arquitetura** | Single Page Application com sincronização offline-first |
| **Banco de dados** | Google Cloud Firestore (NoSQL, tempo real) |
| **Autenticação** | Google OAuth 2.0 (Firebase Auth) |
| **Armazenamento** | Firebase Storage (fotos de animais) |
| **Cache** | IndexedDB com compressão LZ-string |
| **Componentes** | 51+ componentes React |
| **Serviços** | 15+ serviços TypeScript |
| **Hooks** | 10+ hooks customizados |
| **Tipos** | 400+ interfaces/tipos TypeScript |
| **Linhas de código** | ~50.000+ linhas (estimativa) |
| **Testes** | Vitest (framework de testes) |

---

## ANEXOS

---

### ANEXO I - Detalhamento das Funcionalidades Entregues

(Referência: Parte 1 deste documento - Inventário Completo de Funcionalidades)

### ANEXO II - Propriedades Autorizadas para Uso

| Propriedade | Município/UF | Área (ha) | Rebanho Estimado |
|---|---|---|---|
| [Nome da Fazenda] | [Cidade/UF] | [área] | [cabeças] |
| [Adicionar se houver mais] | | | |

### ANEXO III - Tabela de Suporte Estendido (Pós-Manutenção)

| Serviço | Valor Mensal |
|---|---|
| Suporte por e-mail/WhatsApp (resposta em 48h) | R$ 500 |
| Suporte prioritário (resposta em 24h) | R$ 800 |
| Suporte + pequenas correções (até 4h/mês) | R$ 1.200 |
| Suporte + melhorias (até 10h/mês) | R$ 2.500 |

### ANEXO IV - Custos de Infraestrutura (Responsabilidade do Licenciado)

(Referência: Parte 3 deste documento - Tabela de Custos por Tamanho de Rebanho)

---

**FIM DO DOCUMENTO**

*Este documento é confidencial e destinado exclusivamente à apresentação comercial do Sistema de Gestão Pecuária Fazenda São Pedro. A reprodução ou distribuição não autorizada é proibida.*
