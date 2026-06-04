# Mermaid diagrami

Diagrami pokrivajo obseg pobud, glasovanja, komentarjev, SI-PASS podpisov, izvoza dokumentov, analitike in AI presoje. Glavni uporabniki so neprijavljen uporabnik, SI-PASS prijavljen uporabnik in admin.

## Uporabniski diagram

```mermaid
flowchart LR
  Anonymous[Neprijavljen uporabnik]
  Sipass[SI-PASS prijavljen uporabnik]
  Admin[Admin]

  subgraph App[Demokracija 2.0]
    direction TB

    subgraph PublicCases[Javni primeri uporabe]
      direction LR
      PublicList([Pregled javnih pobud])
      Search([Iskanje in filtriranje])
      AnonymousVote([Anonimno glasovanje])
    end

    subgraph SipassCases[SI-PASS primeri uporabe]
      direction LR
      Submit([Oddaja pobude])
      Vote([Glasovanje])
      Comment([Komentiranje])
      SipassSign([SI-PASS podpis])
      ExportDocs([Izvoz PDF DOCX ODT])
      UserAnalytics([Osebna analitika])
    end

    subgraph AdminCases[Admin primeri uporabe]
      direction LR
      StatusAdmin([Urejanje statusov])
      Integrations([Integracije])
      SystemAnalytics([Sistemska analitika])
    end
  end

  Anonymous --> PublicCases
  Sipass --> PublicCases
  Sipass --> SipassCases
  Admin --> AdminCases
```

## Tok oddaje pobude

```mermaid
sequenceDiagram
  actor Uporabnik as SI-PASS prijavljen uporabnik
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

## Glasovanje, podpis in izvoz

```mermaid
sequenceDiagram
  actor Anonymous as Neprijavljen uporabnik
  actor Sipass as SI-PASS prijavljen uporabnik
  actor Admin
  participant UI as Frontend
  participant Repo as Repozitorij
  participant Domain as Domenska logika
  participant Signatures as /api/signatures
  participant Export as Izvoz dokumenta
  participant DB as Supabase/localStorage

  Anonymous->>UI: klik Glasuj anonimno
  UI->>Repo: vote(initiativeId, anonymousActor)
  Repo->>Domain: voteForInitiative(initiative, anonymousActor)
  Domain-->>Repo: pobuda brez podvojenega glasu
  Repo->>DB: shrani anonimen glas
  Sipass->>UI: klik Glasuj ali Komentiraj
  UI->>Repo: vote/comment(initiativeId, sipassActor)
  Repo->>Domain: voteForInitiative/addComment
  Domain-->>Repo: posodobljena pobuda ali validacijska napaka
  Repo->>DB: shrani glas ali komentar
  Sipass->>UI: klik SI-PASS podpis
  UI->>Signatures: POST initiativeId
  Signatures->>DB: shrani podpis method=sipass
  Signatures-->>UI: osvezena pobuda
  Sipass->>UI: klik PDF/DOCX/ODT izvoz
  UI->>UI: preveri status signature_collection/submitted
  UI->>Export: ustvari dokument za DZ
  Export-->>Sipass: prenos ali tiskanje dokumenta
  Admin->>UI: spremeni status pobude
  UI->>Repo: update status
  Repo->>DB: shrani status
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
    string legislativeText
    string articleExplanation
    string financialImpact
    string budgetFunding
    string comparativeReview
    string impactAssessment
    string publicParticipation
    string proposerRepresentatives
    string affectedProvisions
    UserSession author
    string notificationEmail
    AiReview aiReview
    Vote[] votes
    Signature[] signatures
    Comment[] comments
    datetime createdAt
    datetime updatedAt
  }

  class UserSession {
    string id
    string name
    string firstName
    string lastName
    string email
    string role
    string provider
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

  UserSession "1" --> "*" Initiative
  Initiative "1" --> "1" AiReview
  Initiative "1" --> "*" Vote
  Initiative "1" --> "*" Signature
  Initiative "1" --> "*" Comment
  Initiative "1" --> "1" InitiativeAnalytics
```

## ER shema

`USER_IDENTITY` je konceptualni identifikator uporabnika oziroma seje. V trenutni Supabase shemi ni fizicna tabela; vrednosti so zapisane v poljih `author_ref`, `voter_ref`, `signer_ref`, `author_ref` in `user_ref`.

```mermaid
erDiagram
  %% USER_IDENTITY je konceptualni identifikator uporabnika, ne fizicna Supabase tabela.
  USER_IDENTITY ||--o{ INITIATIVES : authors
  USER_IDENTITY ||--o{ VOTES : casts
  USER_IDENTITY ||--o{ SIGNATURES : signs
  USER_IDENTITY ||--o{ COMMENTS : writes
  USER_IDENTITY ||--o{ SYSTEM_ANALYTICS_EVENTS : produces
  INITIATIVES ||--o{ VOTES : has
  INITIATIVES ||--o{ SIGNATURES : has
  INITIATIVES ||--o{ COMMENTS : has
  INITIATIVES ||--o{ INITIATIVE_AI_REVIEWS : reviewed_by

  USER_IDENTITY {
    text user_ref PK
    text display_name
    text provider
    text role
  }

  INITIATIVES {
    uuid id PK
    text author_ref
    text author_name
    text title
    text category
    initiative_status status
    text notification_email
    integer ai_score
    text ai_risk
    timestamptz created_at
    timestamptz updated_at
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
    text author_name
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
    jsonb findings
    jsonb raw_response
    timestamptz created_at
  }

  SYSTEM_ANALYTICS_EVENTS {
    uuid id PK
    text user_ref
    text user_role
    text event_type
    text source
    text session_id
    jsonb data
    timestamptz created_at
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
