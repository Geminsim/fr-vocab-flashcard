import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const flashcardStates = sqliteTable("flashcard_states", {
  userId: text("user_id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  payload: text("payload").notNull(),
});
