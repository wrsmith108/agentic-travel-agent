-- Initial database schema for Travel Agent
-- Migration: 001_initial_schema

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- User preferences (stored as JSONB for flexibility)
    preferences JSONB DEFAULT '{}' NOT NULL,
    
    -- Indexes
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    remember_me BOOLEAN DEFAULT false
);

-- Flight searches table
CREATE TABLE flight_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Search criteria
    origin VARCHAR(3) NOT NULL, -- IATA airport code
    destination VARCHAR(3) NOT NULL, -- IATA airport code
    departure_date DATE NOT NULL,
    return_date DATE,
    
    -- Passenger details
    adults INTEGER NOT NULL DEFAULT 1 CHECK (adults >= 1 AND adults <= 9),
    children INTEGER NOT NULL DEFAULT 0 CHECK (children >= 0 AND children <= 8),
    infants INTEGER NOT NULL DEFAULT 0 CHECK (infants >= 0 AND infants <= 2),
    
    -- Preferences
    travel_class VARCHAR(20) NOT NULL DEFAULT 'ECONOMY' 
        CHECK (travel_class IN ('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST')),
    non_stop BOOLEAN DEFAULT false,
    max_price DECIMAL(10,2),
    currency_code VARCHAR(3) DEFAULT 'USD',
    
    -- Monitoring status
    is_monitoring BOOLEAN DEFAULT false,
    alert_threshold_percent DECIMAL(5,2) DEFAULT 10.0, -- Alert when price drops by X%
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_checked_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_departure_date CHECK (departure_date >= CURRENT_DATE),
    CONSTRAINT valid_return_date CHECK (return_date IS NULL OR return_date >= departure_date),
    CONSTRAINT valid_airport_codes CHECK (origin != destination)
);

-- Flight search results table (for caching and history)
CREATE TABLE flight_search_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_id UUID NOT NULL REFERENCES flight_searches(id) ON DELETE CASCADE,
    
    -- Flight details
    amadeus_offer_id TEXT,
    airline_code VARCHAR(3) NOT NULL,
    airline_name VARCHAR(100),
    flight_number VARCHAR(10),
    
    -- Pricing
    total_price DECIMAL(10,2) NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    price_per_adult DECIMAL(10,2),
    
    -- Schedule
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    stops INTEGER DEFAULT 0,
    
    -- Additional data (stored as JSONB for flexibility)
    flight_details JSONB DEFAULT '{}',
    
    -- Metadata
    searched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_available BOOLEAN DEFAULT true,
    
    -- Indexes for performance
    CONSTRAINT positive_price CHECK (total_price > 0)
);

-- Price history table for tracking price changes
CREATE TABLE flight_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_id UUID NOT NULL REFERENCES flight_searches(id) ON DELETE CASCADE,
    
    -- Price data
    price DECIMAL(10,2) NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    
    -- Source information
    source VARCHAR(50) DEFAULT 'amadeus',
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Optional flight details reference
    result_id UUID REFERENCES flight_search_results(id) ON DELETE SET NULL,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'
);

-- Conversations table for AI chat history
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    
    -- Context and preferences
    travel_context JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE,
    message_count INTEGER DEFAULT 0
);

-- Messages table for conversation history
CREATE TABLE conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Message content
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    -- Optional structured data
    metadata JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sequence_number INTEGER NOT NULL,
    
    -- Ensure proper ordering
    UNIQUE(conversation_id, sequence_number)
);

-- User notifications table
CREATE TABLE user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification details
    type VARCHAR(50) NOT NULL, -- 'price_alert', 'flight_deal', 'system', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Optional related data
    search_id UUID REFERENCES flight_searches(id) ON DELETE SET NULL,
    related_data JSONB DEFAULT '{}',
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;

CREATE INDEX idx_searches_user_id ON flight_searches(user_id);
CREATE INDEX idx_searches_monitoring ON flight_searches(user_id, is_monitoring) WHERE is_monitoring = true;
CREATE INDEX idx_searches_route_date ON flight_searches(origin, destination, departure_date);
CREATE INDEX idx_searches_last_checked ON flight_searches(last_checked_at) WHERE is_monitoring = true;

CREATE INDEX idx_results_search_id ON flight_search_results(search_id);
CREATE INDEX idx_results_price ON flight_search_results(search_id, total_price);
CREATE INDEX idx_results_searched_at ON flight_search_results(searched_at);

CREATE INDEX idx_price_history_search_id ON flight_price_history(search_id);
CREATE INDEX idx_price_history_checked_at ON flight_price_history(checked_at);
CREATE INDEX idx_price_history_price ON flight_price_history(search_id, price);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);

CREATE INDEX idx_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX idx_messages_sequence ON conversation_messages(conversation_id, sequence_number);

CREATE INDEX idx_notifications_user_id ON user_notifications(user_id);
CREATE INDEX idx_notifications_unread ON user_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_type ON user_notifications(user_id, type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flight_searches_updated_at BEFORE UPDATE ON flight_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();