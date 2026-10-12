-- ==============================================================================
-- PURE FOR CURE (HARE KRISHNA MANDIR GUWAHATI)
-- SUPABASE SCHEMA & AUTOMATION FOR NEWSLETTER & BLOG POST NOTIFICATIONS
-- Project URL: https://icadpdzapgkxqbvqldzy.supabase.co
-- ==============================================================================

-- 1. Create Newsletter Subscribers Table
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT DEFAULT 'Devotee / Friend',
    email TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
    source_page TEXT DEFAULT 'footer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow anonymous visitors to subscribe from any webpage
CREATE POLICY "Allow public inserts for subscribers" 
ON public.newsletter_subscribers 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Allow reading active subscribers for broadcast/admin
CREATE POLICY "Allow reading active subscribers" 
ON public.newsletter_subscribers 
FOR SELECT 
TO anon, authenticated
USING (status = 'active');

-- Index on email & status for high performance
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON public.newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status ON public.newsletter_subscribers(status);

-- ==============================================================================
-- 2. Create Blog Posts / Stories Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    excerpt TEXT,
    content TEXT,
    cover_image_url TEXT,
    author TEXT DEFAULT 'Pure for Cure Team',
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Allow public read of published blog posts
CREATE POLICY "Allow public read of published blog posts"
ON public.blog_posts
FOR SELECT
TO anon, authenticated
USING (status = 'published');

-- Allow authenticated/service role to insert and update
CREATE POLICY "Allow authenticated insert of blog posts"
ON public.blog_posts
FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- 3. Automatic Trigger to Log / Notify on New Blog Post Creation
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.newsletter_dispatch_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.blog_posts(id) ON DELETE CASCADE,
    post_title TEXT,
    total_subscribers_targeted INTEGER DEFAULT 0,
    dispatched_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'completed'
);

-- Function to handle automated trigger on new blog post
CREATE OR REPLACE FUNCTION public.handle_new_blog_post_notification()
RETURNS TRIGGER AS $$
DECLARE
    sub_count INTEGER;
BEGIN
    IF NEW.status = 'published' THEN
        SELECT COUNT(*) INTO sub_count FROM public.newsletter_subscribers WHERE status = 'active';

        INSERT INTO public.newsletter_dispatch_log (post_id, post_title, total_subscribers_targeted, status)
        VALUES (NEW.id, NEW.title, sub_count, 'queued');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS trigger_new_blog_post_notification ON public.blog_posts;
CREATE TRIGGER trigger_new_blog_post_notification
AFTER INSERT ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_blog_post_notification();
