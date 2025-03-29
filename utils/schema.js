import { serial, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";

export const MockInterview = pgTable('mockInterview', {
    id: serial('id').primaryKey(),
    jsonMockResp: text('jsonMockResp').notNull(),
    jobPosition: varchar('jobPosition').notNull(),
    jobDesc: text('jobDesc').notNull(),
    jobExperience: varchar('jobExperience').notNull(),
    createdBy: varchar('createdBy').notNull(),
    createdAt: varchar('createdAt'),
    mockId: varchar('mockId').notNull()
})

export const UserAnswer = pgTable('userAnswer', {
    id: serial('id').primaryKey(),
    mockIdref: varchar('mockId').notNull(),
    question: varchar('question').notNull(),
    correctAns: text('correctAns'),
    userAns: text('userAns'),
    feedback: text('feedback'),
    rating: varchar('rating'),
    userEmail: text('userEmail'),
    createdAt: varchar('createdAt'),
    isCodingQuestion: boolean('isCodingQuestion').default(false),
    codeLanguage: varchar('codeLanguage'),
    testCases: text('testCases')
})
