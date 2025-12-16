CREATE TABLE "user" (
    id SERIAL PRIMARY KEY,

    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    is_admin BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT user_email_or_phone_check CHECK (
        email IS NOT NULL
        OR phone IS NOT NULL
    )
);

CREATE INDEX index__user__first_name ON "user"(first_name);
CREATE INDEX index__user__last_name ON "user"(last_name);
CREATE INDEX index__user__email ON "user"(email);
CREATE INDEX index__user__phone ON "user"(phone);
CREATE INDEX index__user__deleted_at ON "user"(deleted_at) WHERE deleted_at IS NULL;