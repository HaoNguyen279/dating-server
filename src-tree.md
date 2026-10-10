# Cây thư mục `src`

```text
src/
├── app.ts
├── config/
│   └── cors.ts
├── generated/
│   └── prisma/
│       ├── browser.ts
│       ├── client.ts
│       ├── commonInputTypes.ts
│       ├── enums.ts
│       ├── models.ts
│       ├── internal/
│       │   ├── class.ts
│       │   ├── prismaNamespace.ts
│       │   └── prismaNamespaceBrowser.ts
│       └── models/
│           ├── conversations.ts
│           ├── matches.ts
│           ├── messages.ts
│           ├── photos.ts
│           ├── preferences.ts
│           ├── profiles.ts
│           ├── swipes.ts
│           └── users.ts
├── infrastructure/
│   └── database/
│       └── prisma.ts
├── lib/
│   └── prisma.ts
├── middlewares/
│   ├── authenticate.ts
│   ├── error-handler.ts
│   └── not-found.ts
└── modules/
    ├── auth/
    │   ├── auth.controller.ts
    │   ├── auth.repository.ts
    │   ├── auth.routes.ts
    │   ├── auth.service.ts
    │   └── auth.validation.ts
    ├── chat/
    │   ├── chat.controller.ts
    │   ├── chat.repository.ts
    │   ├── chat.routes.ts
    │   └── chat.service.ts
    ├── matches/
    │   ├── matches.controller.ts
    │   ├── matches.repository.ts
    │   ├── matches.routes.ts
    │   └── matches.service.ts
    ├── profiles/
    │   ├── profiles.container.ts
    │   ├── profiles.controller.ts
    │   ├── profiles.repository.ts
    │   ├── profiles.routes.ts
    │   ├── profiles.service.ts
    │   └── profiles.validation.ts
    ├── recommendations/
    │   ├── recommendations.controller.ts
    │   ├── recommendations.repository.ts
    │   ├── recommendations.routes.ts
    │   └── recommendations.service.ts
    ├── swipes/
    │   ├── swipes.controller.ts
    │   ├── swipes.repository.ts
    │   ├── swipes.routes.ts
    │   ├── swipes.service.ts
    │   └── swipes.validation.ts
    └── users/
        ├── users.controller.ts
        ├── users.repository.ts
        ├── users.routes.ts
        ├── users.service.ts
        └── users.validation.ts
```
