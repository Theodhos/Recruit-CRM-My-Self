-- A company moves to Win only with a proof document (screenshot, file…); it is kept in its own category.
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'WIN_PROOF';
