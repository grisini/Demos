# Mermaid diagrami

Diagrami pokrivajo samo obseg pobud, glasovanja, komentarjev, analitike in AI presoje.

## Uporabniski diagram

```mermaid
flowchart LR
  Citizen[Drzavljan]
  Moderator[Urednik ali moderator]
  AI[AI presoja]
  Platform[Demokracija 2.0]
  Database[(Supabase / localStorage)]

  Citizen -->|oddaja pobudo| Platform
  Citizen -->|isce in filtrira pobude| Platform
  Citizen -->|glasuje| Platform
  Citizen -->|komentira| Platform
  Platform -->|shrani pobudo, glas, komentar| Database
  Platform -->|zahteva predpregled| AI
  AI -->|score, risk, kategorija, ugotovitve| Platform
  Moderator -->|spreminja status| Platform
  Moderator -->|pregleda analitiko| Platform
```

## Tok oddaje pobude

```mermaid
sequenceDiagram
  actor Uporabnik
  participant UI as Frontend
  participant Domain as Domenska logika
  participant AI as Dev AI endpoint
  participant HF as Hugging Face
  participant Repo as Repozitorij
  participant DB as Supabase/localStorage

  Uporabnik->>UI: vnese pobudo
  UI->>Domain: validateInitiative(draft)
  Domain-->>UI: napake ali normalizirane vrednosti
  UI->>Domain: evaluateInitiative(draft)
  Domain-->>UI: lokalni AI fallback
  UI->>AI: POST /api/ai/review-initiative
  AI->>HF: zero-shot kategorija in ustreznost
  HF-->>AI: labels in scores
  AI-->>UI: score, risk, suitability, categorySuggestion
  UI->>Repo: create(initiative)
  Repo->>DB: insert initiative
  DB-->>Repo: shranjeno
  Repo-->>UI: nova pobuda
  UI-->>Uporabnik: prikaz pobude in analitike
```

## Glasovanje in komentiranje

```mermaid
sequenceDiagram
  actor Uporabnik
  participant UI as Frontend
  participant Repo as Repozitorij
  participant Domain as Domenska logika
  participant DB as Podatki

  Uporabnik->>UI: klik Glasuj
  UI->>Repo: vote(initiativeId, actor)
  Repo->>Domain: voteForInitiative(initiative, actor)
  Domain-->>Repo: pobuda brez podvojenega glasu
  Repo->>DB: shrani glas
  UI->>Repo: comment(initiativeId, actor, body)
  Repo->>Domain: addComment(initiative, actor, body)
  Domain-->>Repo: komentar ali validacijska napaka
  Repo->>DB: shrani komentar
  UI-->>Uporabnik: posodobljeni glasovi in komentarji
```

## UML domenskih objektov

```mermaid
classDiagram
  class Initiative {
    string id
    string title
    string category
    string status
    string summary
    string description
    string legalReference
    string expectedImpact
    AiReview aiReview
    Vote[] votes
    Signature[] signatures
    Comment[] comments
  }

  class AiReview {
    number score
    string risk
    string suitability
    string[] findings
    object checks
  }

  class Vote {
    string userId
    string userName
    datetime createdAt
  }

  class Signature {
    string userId
    string userName
    string method
    datetime createdAt
  }

  class Comment {
    string id
    string userId
    string userName
    string body
    datetime createdAt
  }

  class InitiativeAnalytics {
    number votes
    number voteShare
    number signatures
    number comments
    number engagementScore
  }

  Initiative "1" --> "1" AiReview
  Initiative "1" --> "*" Vote
  Initiative "1" --> "*" Signature
  Initiative "1" --> "*" Comment
  Initiative "1" --> "1" InitiativeAnalytics
```

## ER shema

```mermaid
erDiagram
  INITIATIVES ||--o{ VOTES : has
  INITIATIVES ||--o{ SIGNATURES : has
  INITIATIVES ||--o{ COMMENTS : has
  INITIATIVES ||--o{ INITIATIVE_AI_REVIEWS : reviewed_by

  INITIATIVES {
    uuid id PK
    text title
    text category
    initiative_status status
    integer ai_score
    text ai_risk
    jsonb ai_findings
    jsonb ai_checks
    timestamptz created_at
  }

  VOTES {
    uuid id PK
    uuid initiative_id FK
    text voter_ref
    text voter_name
    timestamptz created_at
  }

  SIGNATURES {
    uuid id PK
    uuid initiative_id FK
    text signer_ref
    text signer_name
    text method
    timestamptz created_at
  }

  COMMENTS {
    uuid id PK
    uuid initiative_id FK
    text author_ref
    text body
    timestamptz created_at
  }

  INITIATIVE_AI_REVIEWS {
    uuid id PK
    uuid initiative_id FK
    text provider
    text model
    integer score
    text risk
    text suitability
    text suggested_category
    jsonb checks
    jsonb raw_response
  }
```

## DevWork loop

```mermaid
flowchart TD
  A[Pregled zahtev] --> B[Pregled obstojece kode]
  B --> C[Omejitev obsega]
  C --> D[Implementacija domene in UI]
  D --> E[Shema in dokumentacija]
  E --> F[Testi]
  F --> G[Porocilo napredka]
  G --> B
```
