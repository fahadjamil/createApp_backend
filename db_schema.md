Backend Database Schema (from Sequelize models)
==============================================

Notes
-----
- This schema is derived from the Sequelize model definitions in `src/models`.
- Draft projects are stored in the `projects` table using the `isDraft` flag.

Tables
------

user
  - uid: UUID, primary key, default UUIDV4
  - email: STRING, not null, unique
  - username: STRING, nullable, unique
  - password: STRING, not null
  - pin: STRING, not null, default "0000"
  - phone: STRING, nullable, unique
  - firstName: STRING, nullable
  - lastName: STRING, nullable
  - searchTerm: STRING, nullable
  - full_name: STRING, nullable
  - avatar_url: STRING, nullable
  - role: STRING, default "creator"
  - resetPasswordToken: STRING, nullable
  - resetPasswordExpires: DATE, nullable
  - firebaseUid: STRING, nullable
  - isEmailVerified: BOOLEAN, default false
  - isDeleted: BOOLEAN, default false
  - createdAt: DATE
  - updatedAt: DATE
  - deletedAt: DATE (paranoid)

projects
  - pid: UUID, primary key, default UUIDV4
  - projectName: STRING, nullable, default "Untitled Draft"
  - projectType: STRING, nullable
  - clientName: STRING, nullable
  - client: STRING, nullable
  - startDate: DATE, nullable
  - endDate: DATE, nullable
  - description: TEXT, nullable
  - tags: JSON, nullable
  - media: JSON, nullable
  - paymentType: STRING, nullable
  - dueDate: DATE, nullable
  - projectAmount: DECIMAL(15,2), nullable
  - currency: STRING, nullable
  - taxHandling: STRING, nullable
  - paymentFrequency: ENUM("weekly","monthly","quarterly"), nullable
  - paymentStartDate: DATE, nullable
  - contractDuration: INTEGER, nullable
  - financing: STRING, nullable
  - paymentMethod: STRING, nullable
  - paymentStructure: ENUM("single","recurring","multiple"), nullable
  - milestones: JSON, nullable
  - agree: BOOLEAN, default false
  - projectStatus: STRING, nullable
  - isDraft: BOOLEAN, default false
  - contactName: STRING, nullable
  - contactEmail: STRING, nullable
  - contactNumber: STRING, nullable
  - contactRole: STRING, nullable
  - contactBrand: STRING, nullable
  - userId: UUID, nullable, references user(uid)
  - createdAt: DATE
  - updatedAt: DATE
  - deletedAt: DATE (paranoid)


clients
  - cid: UUID, primary key, default UUIDV4
  - fullName: STRING, nullable
  - clientType: STRING, nullable
  - company: STRING, nullable
  - email: STRING, nullable
  - phone: STRING, not null
  - address: TEXT, nullable
  - contactPersonName: STRING, nullable
  - contactPersonRole: STRING, nullable
  - projectId: UUID, nullable, references projects(pid)
  - userId: UUID, not null, references user(uid)
  - createdAt: DATE
  - updatedAt: DATE
  - deletedAt: DATE (paranoid)

analytics
  - id: UUID, primary key, default UUIDV4
  - eventName: STRING, not null
  - eventCategory: ENUM("auth","project","client","payment","navigation","ui_interaction",
      "form","gesture","search","profile","onboarding","dashboard","error","engagement",
      "funnel","other"), default "other"
  - userId: UUID, nullable, references user(uid)
  - sessionId: STRING, nullable
  - screenName: STRING, nullable
  - section: STRING, nullable
  - properties: JSONB, nullable, default {}
  - platform: ENUM("ios","android","web","desktop"), nullable
  - appVersion: STRING, nullable
  - deviceModel: STRING, nullable
  - osVersion: STRING, nullable
  - ipAddress: STRING, nullable
  - country: STRING, nullable
  - city: STRING, nullable
  - clientTimestamp: DATE, nullable
  - duration: INTEGER, nullable
  - elementId: STRING, nullable
  - elementType: STRING, nullable
  - elementText: STRING, nullable
  - errorCode: STRING, nullable
  - errorMessage: TEXT, nullable
  - errorType: STRING, nullable
  - createdAt: DATE
  - updatedAt: DATE
  Indexes: eventName, eventCategory, userId, screenName, platform, createdAt, sessionId

notification
  - id: UUID, primary key, default UUIDV4
  - userId: UUID, not null, references user(uid)
  - title: STRING(255), not null
  - body: TEXT, not null
  - type: ENUM("project_update","project_approved","project_rejected","payment_received",
      "payment_pending","message","reminder","system","general"), default "general"
  - data: JSONB, nullable, default {}
  - projectId: UUID, nullable
  - clientId: UUID, nullable
  - status: ENUM("pending","sent","delivered","failed","read"), default "pending"
  - expoReceiptId: STRING, nullable
  - errorMessage: TEXT, nullable
  - sentAt: DATE, nullable
  - deliveredAt: DATE, nullable
  - readAt: DATE, nullable
  - scheduledFor: DATE, nullable
  - priority: ENUM("low","normal","high"), default "normal"
  - channelId: STRING, nullable, default "default"
  - createdAt: DATE
  - updatedAt: DATE
  Indexes: userId, status, type, createdAt, (userId,status)

push_token
  - id: UUID, primary key, default UUIDV4
  - userId: UUID, not null, references user(uid)
  - token: STRING(500), not null
  - platform: ENUM("ios","android","web"), not null, default "android"
  - deviceId: STRING, nullable
  - deviceName: STRING, nullable
  - isActive: BOOLEAN, default true
  - lastUsedAt: DATE, nullable
  - preferences: JSONB, nullable, default {
      projectUpdates: true,
      payments: true,
      messages: true,
      reminders: true,
      marketing: false
    }
  - createdAt: DATE
  - updatedAt: DATE
  Indexes: unique(userId,token), token, userId

Relationships
-------------
- user 1..* projects (projects.userId -> user.uid)
- user 1..* draft projects (projects.isDraft = true)
- user 1..* clients (clients.userId -> user.uid)
- projects 1..* clients (clients.projectId -> projects.pid)
- user 1..* analytics (analytics.userId -> user.uid)
- user 1..* push_token (push_token.userId -> user.uid)
- user 1..* notification (notification.userId -> user.uid)
