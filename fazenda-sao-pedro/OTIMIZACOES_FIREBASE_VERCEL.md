# 🔧 Relatório de Otimizações - Firebase & Vercel Free Tier

## 📊 Análise do Projeto Fazenda São Pedro

---

## ✅ O QUE JÁ ESTÁ BOM

### 1. Cache Local (IndexedDB) ✓
- Implementação de `localCache.ts` com stale-while-revalidate
- TTL de 30 minutos configurável
- Reduz leituras do Firestore significativamente

### 2. Gemini Service Otimizado ✓  
- Cache de respostas da IA
- Rate limiting (15 chamadas/minuto)
- Lazy initialization
- Respostas locais para perguntas frequentes no chatbot

### 3. Weather Service ✓
- Cache de 30 minutos
- Usa Open-Meteo (gratuito, sem limite)

### 4. Vite Config ✓
- Code splitting configurado
- Console.logs removidos em produção

---

## 🚨 PROBLEMAS CRÍTICOS A CORRIGIR

### 1. **Listeners em Tempo Real Ausentes mas Sync Frequente**
**Arquivo:** `useFirestoreOptimized.ts`

**Problema:** O código não usa `onSnapshot` (listeners), mas faz sync manual frequente que pode consumir muitos reads.

**Solução:** Aumentar TTL do cache e adicionar sync inteligente:

```typescript
// constants/app.ts - ALTERAR
export const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hora (era 30 min)
export const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 min (era 5 min)
```

### 2. **Queries Sem Limit**
**Arquivo:** `useFirestoreOptimized.ts` (linha 245-247)

**Problema:** Busca TODOS os documentos sem paginação.

```typescript
// ATUAL (ruim)
const snapshot = await db.collection(firestorePath)
    .where("userId", "==", userId)
    .get();
```

**Solução:** Adicionar paginação para coleções grandes:

```typescript
// OTIMIZADO
const snapshot = await db.collection(firestorePath)
    .where("userId", "==", userId)
    .orderBy('createdAt', 'desc')
    .limit(100) // Limita leituras iniciais
    .get();
```

### 3. **forceSync Limpa Cache e Refaz TUDO**
**Arquivo:** `useFirestoreOptimized.ts` (linha 369-387)

**Problema:** Cada `forceSync` faz 5 queries completas.

**Solução:** Sync incremental usando timestamps:

```typescript
// Adicionar campo lastModified em cada documento
// Depois buscar apenas modificados desde lastSync:
.where("lastModified", ">", lastSyncTimestamp)
```

### 4. **Múltiplas Queries em Cascade**
**Arquivo:** `deleteManagementArea` (linha 794-797)

**Problema:** Query extra para encontrar animais na área.

**Solução:** Manter lista local e evitar query:

```typescript
// ATUAL (2 queries)
const animalsInAreaQuery = db.collection('animals')
    .where('userId', '==', userId)
    .where('managementAreaId', '==', areaId);
const snapshot = await animalsInAreaQuery.get(); // EXTRA READ!

// OTIMIZADO (0 queries extras)
const animalsInArea = state.animals.filter(a => a.managementAreaId === areaId);
// Usar batch.update com os IDs já conhecidos
```

---

## 📋 OTIMIZAÇÕES RECOMENDADAS

### A. **Firestore (Economia de ~70% reads)**

```typescript
// 1. Adicionar em constants/app.ts
export const FIRESTORE_LIMITS = {
  INITIAL_LOAD: 50,      // Limite no carregamento inicial
  PAGINATION_SIZE: 25,   // Itens por página
  MAX_BATCH_WRITE: 500,  // Máximo do Firestore
};

// 2. Implementar carregamento lazy de históricos
// Não carregar historicoSanitario, historicoPesagens no load inicial
// Carregar apenas quando abrir AnimalDetailModal
```

### B. **Vercel (Economia de bandwidth)**

```typescript
// vite.config.ts - ADICIONAR
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: 'gzip' }), // Comprime assets
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'gemini': ['@google/genai'],
          'charts': ['recharts'], // Se usar
        }
      }
    }
  }
});
```

### C. **Service Worker para Offline-First**

```javascript
// public/sw.js - MELHORAR
const CACHE_VERSION = 'v3';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Cache Firestore responses localmente
self.addEventListener('fetch', event => {
  if (event.request.url.includes('firestore.googleapis.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetched = fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(API_CACHE).then(cache => {
            cache.put(event.request, clone);
          });
          return response;
        });
        return cached || fetched;
      })
    );
  }
});
```

---

## 📊 ESTIMATIVA DE ECONOMIA

| Recurso | Antes | Depois | Economia |
|---------|-------|--------|----------|
| Firestore Reads/dia | ~5000 | ~1500 | **70%** |
| Firestore Writes/dia | ~200 | ~200 | 0% |
| Vercel Bandwidth | ~500MB | ~200MB | **60%** |
| Gemini API calls | ~100 | ~30 | **70%** |

---

## 🔧 CÓDIGO PRONTO PARA APLICAR

### 1. Atualizar `constants/app.ts`:

```typescript
// Cache mais agressivo
export const CACHE_VERSION = 'v3'; // Incrementar ao deploy
export const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hora
export const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

// Limites de query
export const QUERY_LIMITS = {
  ANIMALS_INITIAL: 100,
  EVENTS_INITIAL: 50,
  TASKS_INITIAL: 30,
};
```

### 2. Adicionar debounce no sync manual:

```typescript
// hooks/useFirestoreOptimized.ts - adicionar
import { useMemo } from 'react';

// Dentro do hook, antes do return:
const debouncedSync = useMemo(() => {
  let timeout: NodeJS.Timeout;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(forceSync, 5000); // 5s debounce
  };
}, [forceSync]);
```

### 3. Firestore Rules otimizadas:

```javascript
// firestore.rules - garantir índices compostos
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /animals/{animalId} {
      allow read: if request.auth != null 
                  && resource.data.userId == request.auth.uid;
      // Limitar campos retornados seria via Security Rules com field masks
      // mas Firestore não suporta nativamente - usar Cloud Functions se necessário
    }
  }
}
```

---

## ⚡ QUICK WINS (Implementar Primeiro)

1. **[5 min]** Aumentar CACHE_EXPIRY_MS para 1 hora
2. **[5 min]** Adicionar `.limit(100)` nas queries iniciais
3. **[10 min]** Remover query extra em `deleteManagementArea`
4. **[15 min]** Implementar debounce no forceSync

---

## 📌 LIMITES FREE TIER (Referência)

### Firebase Spark (Free):
- **Firestore**: 50K reads/dia, 20K writes/dia, 20K deletes/dia
- **Storage**: 5GB, 1GB/dia download
- **Auth**: 50K/mês verificações

### Vercel Hobby (Free):
- **Bandwidth**: 100GB/mês
- **Serverless Functions**: 100GB-hrs/mês
- **Builds**: 6000 min/mês

---

*Relatório gerado em: 09/12/2024*
