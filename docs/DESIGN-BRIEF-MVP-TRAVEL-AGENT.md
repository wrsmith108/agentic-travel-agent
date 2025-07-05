# Design Brief: MVP Travel Agent

**Document Version**: 1.0  
**Date**: December 2024  
**Prepared by**: Design Director  
**Status**: For Implementation

## Table of Contents
1. [Design Vision & Strategy](#design-vision--strategy)
2. [Design Principles & Guidelines](#design-principles--guidelines)
3. [Agent Personality & Voice](#agent-personality--voice)
4. [UI/UX Specifications](#uiux-specifications)
5. [User Experience Flow](#user-experience-flow)
6. [Design System Components](#design-system-components)
7. [Accessibility & Performance](#accessibility--performance)
8. [Implementation Notes](#implementation-notes)

---

## Design Vision & Strategy

### Product Vision
Create a conversational travel agent that feels like chatting with a knowledgeable, friendly travel expert who remembers your preferences and proactively helps you find great flight deals.

### Design Strategy
- **Simplicity First**: Clean, distraction-free interface that guides users naturally
- **Trust Through Transparency**: Clear about capabilities, limitations, and data usage
- **Delightful Efficiency**: Fast, accurate results with personality
- **Progressive Disclosure**: Start simple, reveal complexity as needed

### MVP Focus Areas (Based on CTO Review)
1. Single-turn flight search with guided conversation
2. Save up to 3 searches for monitoring
3. Email notifications for price changes
4. Form-based fallbacks for reliability

---

## Design Principles & Guidelines

### Core Design Principles

#### 1. Conversational Clarity
- **Principle**: Every interaction should feel natural and purposeful
- **Application**: Use progressive disclosure, clear CTAs, and contextual help
- **Example**: "I found 12 flights. Would you like to see the cheapest options first?"

#### 2. Trustworthy Guidance
- **Principle**: Be transparent about capabilities and guide users to success
- **Application**: Clear system status, honest limitations, helpful error messages
- **Example**: "I can search for flights between major airports. For smaller airports, I'll find the nearest major hub."

#### 3. Effortless Efficiency
- **Principle**: Minimize cognitive load while maximizing task completion
- **Application**: Smart defaults, one-click actions, remembered preferences
- **Example**: Auto-detect user's likely home airport based on location

#### 4. Accessible Simplicity
- **Principle**: Design for everyone, including users with disabilities
- **Application**: High contrast, keyboard navigation, screen reader support
- **Example**: All interactive elements have clear focus states

### Visual Design System

#### Color Palette
```scss
// Primary Colors
$primary-blue: #0066FF;      // Main brand color, CTAs
$primary-dark: #0052CC;      // Hover states, emphasis
$primary-light: #E6F0FF;     // Backgrounds, subtle elements

// Neutral Colors
$neutral-900: #1A1A1A;       // Primary text
$neutral-700: #4A4A4A;       // Secondary text
$neutral-500: #767676;       // Tertiary text, placeholders
$neutral-300: #D1D1D1;       // Borders, dividers
$neutral-100: #F5F5F5;       // Backgrounds
$neutral-000: #FFFFFF;       // White

// Semantic Colors
$success-green: #00A85D;     // Success states, savings
$warning-amber: #FF9500;     // Warnings, important info
$error-red: #E02020;         // Errors, critical actions
$info-blue: #0099E0;         // Information, tips

// Agent Message Background
$agent-bg: #F8F9FA;          // Slight gray tint for agent messages
```

#### Typography
```scss
// Font Stack
$font-primary: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
$font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace;

// Type Scale
$text-xs: 12px;      // Timestamps, meta info
$text-sm: 14px;      // Secondary text, captions
$text-base: 16px;    // Body text, default
$text-lg: 18px;      // Subheadings
$text-xl: 24px;      // Section headers
$text-2xl: 32px;     // Page titles

// Line Heights
$leading-tight: 1.25;
$leading-normal: 1.5;
$leading-relaxed: 1.75;

// Font Weights
$font-normal: 400;
$font-medium: 500;
$font-semibold: 600;
$font-bold: 700;
```

#### Spacing System
```scss
// Base unit: 4px
$space-1: 4px;
$space-2: 8px;
$space-3: 12px;
$space-4: 16px;
$space-5: 20px;
$space-6: 24px;
$space-8: 32px;
$space-10: 40px;
$space-12: 48px;
$space-16: 64px;
```

#### Shadows & Elevations
```scss
// Elevation levels
$shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
$shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
$shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
$shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1);

// Special shadows
$shadow-focus: 0 0 0 3px rgba(0, 102, 255, 0.25);
$shadow-error: 0 0 0 3px rgba(224, 32, 32, 0.25);
```

### Interaction Patterns

#### Animation Principles
- **Duration**: 200-300ms for micro-interactions, 400-600ms for page transitions
- **Easing**: Use `ease-out` for entrances, `ease-in` for exits
- **Purpose**: Every animation should aid comprehension, not just decorate

#### Micro-interactions
```scss
// Button hover
.button {
  transition: all 200ms ease-out;
  &:hover {
    transform: translateY(-1px);
    box-shadow: $shadow-md;
  }
}

// Message appearance
@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## Agent Personality & Voice

### Personality Profile

#### Core Traits
1. **Knowledgeable Professional**
   - Expertise without arrogance
   - Uses industry terms but explains them
   - Admits limitations honestly

2. **Warm Guide**
   - Friendly but not overly casual
   - Patient with questions
   - Celebrates user successes

3. **Proactive Helper**
   - Anticipates user needs
   - Offers relevant suggestions
   - Prevents common mistakes

4. **Efficient Communicator**
   - Gets to the point quickly
   - Uses bullet points for clarity
   - Summarizes complex information

### Voice & Tone Guidelines

#### Voice Attributes
- **Clear**: Simple language, short sentences
- **Confident**: Direct statements, no hedging
- **Helpful**: Action-oriented, solution-focused
- **Human**: Natural contractions, conversational flow

#### Tone Variations by Context

**First Interaction**
- Warmer, more welcoming
- Sets expectations clearly
- Builds trust

**Search Process**
- Focused and efficient
- Guide through options
- Clarify when needed

**Results Presentation**
- Organized and scannable
- Highlight key information
- Offer next steps

**Error Handling**
- Calm and reassuring
- Take responsibility
- Provide clear solutions

### Example Conversations

#### Successful Search Flow
```
User: "I need to fly to London"

Agent: "I'd be happy to help you find flights to London! To show you the best options, I need a few quick details:

• Where will you be flying from?
• What date would you like to depart?
• Will this be a round trip or one-way?

Just type your answers, or click the form below if you prefer."

User: "From Boston on March 15th, round trip"

Agent: "Great! Boston to London on March 15th. When would you like to return?"

User: "March 22"

Agent: "Perfect! Let me search for round-trip flights from Boston to London, departing March 15th and returning March 22nd...

✈️ I found 18 flights that match your criteria! Here are the 3 best options:

**Option 1 - Best Value**
🎯 British Airways | $487 round trip
Depart: 9:50 PM → Arrive: 8:30 AM+1 (Direct)
Return: 11:25 AM → Arrive: 2:40 PM (Direct)

**Option 2 - Most Convenient**
💼 Virgin Atlantic | $542 round trip
Depart: 7:15 PM → Arrive: 6:25 AM+1 (Direct)
Return: 4:30 PM → Arrive: 7:45 PM (Direct)

**Option 3 - Budget Friendly**
💰 TAP Air Portugal | $412 round trip
Depart: 5:00 PM → Arrive: 11:10 AM+1 (1 stop in Lisbon)
Return: 12:50 PM → Arrive: 7:55 PM (1 stop in Lisbon)

Would you like to see more options, filter by specific airlines, or save this search to monitor for price changes?"
```

#### Error Recovery Flow
```
User: "Fly me to Paris tomorrow from wherever"

Agent: "I'd love to help you get to Paris! However, I need to know which city you'll be departing from to find accurate flights.

Could you tell me your departure city? For example:
• "New York" or "NYC"
• "Los Angeles" or "LAX"
• "Chicago" or "ORD"

Or click below to share your location and I'll find your nearest airport."

User: "I'm in Boston but I made a mistake, I meant next month not tomorrow"

Agent: "No problem at all! Let's search for flights from Boston to Paris next month instead. 

What specific date in next month works best for you? If you're flexible with dates, I can search for the cheapest options across the whole month."
```

#### Saved Search Interaction
```
Agent: "Would you like to save this search? I'll check for price changes weekly and email you when I find better deals.

💡 You can save up to 3 flight searches. Current savings found for other users: $85 average per ticket!"

User: "Yes, save it"

Agent: "Excellent! I've saved your Boston → London search (Mar 15-22). 

✅ I'll check for better prices every Tuesday
📧 You'll get an email if prices drop or new flights appear
💰 Current best price to beat: $412

Name this saved search (optional): "Spring London Trip" or leave blank for "BOS-LON Mar 15-22"
```

### Do's and Don'ts

#### DO's ✅
- Use "I" and "we" to create partnership
- Acknowledge user input: "Got it!" "Perfect!"
- Provide context for wait times: "This usually takes 3-5 seconds..."
- Celebrate savings: "Great news! I found a flight $50 cheaper!"
- Use emojis sparingly for clarity: ✈️ 💰 ⏰ 📧
- Break up long responses with formatting

#### DON'TS ❌
- Don't use robotic language: "Processing request..."
- Don't blame the user: "You entered an invalid date"
- Don't use excessive exclamation points!!!
- Don't be overly casual: "Hey bestie!"
- Don't use technical jargon without explanation
- Don't make promises you can't keep

---

## UI/UX Specifications

### Layout Structure

#### Desktop Layout (1200px+)
```
┌─────────────────────────────────────────────────────────┐
│                    Header (60px)                        │
├─────────────────┬───────────────────────────────────────┤
│                 │                                       │
│   Dashboard     │        Chat Interface                │
│   (320px)       │        (flex: 1)                    │
│                 │                                       │
│ - Saved Searches│     - Conversation Area             │
│ - Quick Stats   │     - Input Area                    │
│ - User Menu     │     - Quick Actions                 │
│                 │                                       │
└─────────────────┴───────────────────────────────────────┘
```

#### Tablet Layout (768px - 1199px)
- Dashboard collapses to slide-out drawer
- Chat interface takes full width
- Hamburger menu for dashboard access

#### Mobile Layout (<768px)
- Single column layout
- Tab navigation between Chat and Dashboard
- Simplified flight cards
- Thumb-friendly touch targets (44px minimum)

### Component Specifications

#### Chat Message Bubbles

**User Messages**
```scss
.message--user {
  max-width: 70%;
  margin-left: auto;
  background: $primary-blue;
  color: white;
  padding: $space-3 $space-4;
  border-radius: 18px 18px 4px 18px;
  margin-bottom: $space-2;
}
```

**Agent Messages**
```scss
.message--agent {
  max-width: 85%;
  background: $agent-bg;
  color: $neutral-900;
  padding: $space-4;
  border-radius: 4px 18px 18px 18px;
  margin-bottom: $space-3;
  border: 1px solid $neutral-300;
}
```

**System Messages**
```scss
.message--system {
  text-align: center;
  color: $neutral-500;
  font-size: $text-sm;
  padding: $space-2 0;
  margin: $space-4 0;
}
```

#### Flight Result Cards

**Structure**
```html
<div class="flight-card">
  <div class="flight-card__header">
    <div class="airline">
      <img src="airline-logo.svg" alt="British Airways">
      <span class="airline__name">British Airways</span>
    </div>
    <div class="price">
      <span class="price__amount">$487</span>
      <span class="price__type">round trip</span>
    </div>
  </div>
  
  <div class="flight-card__body">
    <div class="flight-leg">
      <div class="flight-time">
        <span class="time">9:50 PM</span>
        <span class="airport">BOS</span>
      </div>
      <div class="flight-duration">
        <span class="duration">7h 40m</span>
        <div class="flight-line">
          <span class="flight-type">Direct</span>
        </div>
      </div>
      <div class="flight-time">
        <span class="time">8:30 AM+1</span>
        <span class="airport">LHR</span>
      </div>
    </div>
  </div>
  
  <div class="flight-card__actions">
    <button class="btn btn--secondary">View Details</button>
    <button class="btn btn--primary">Select Flight</button>
  </div>
</div>
```

**Visual Specs**
- Card background: white with `$shadow-sm`
- Hover state: `$shadow-md` with 200ms transition
- Border: 1px solid `$neutral-300`
- Border radius: 8px
- Padding: `$space-4`
- Margin between cards: `$space-3`

#### Input Area

**Default State**
```html
<div class="chat-input">
  <textarea 
    class="chat-input__field" 
    placeholder="Type your message or use the form below..."
    rows="1"
  ></textarea>
  <button class="chat-input__send" aria-label="Send message">
    <svg><!-- Send icon --></svg>
  </button>
</div>
```

**Specs**
- Background: white
- Border: 2px solid `$neutral-300`
- Focus border: 2px solid `$primary-blue`
- Border radius: 24px
- Min height: 48px
- Auto-expand up to 3 lines
- Send button: 36px circle, `$primary-blue` background

#### Quick Action Buttons
```scss
.quick-actions {
  display: flex;
  gap: $space-2;
  padding: $space-3 0;
  overflow-x: auto;
  
  .quick-action {
    white-space: nowrap;
    padding: $space-2 $space-3;
    border: 1px solid $neutral-300;
    border-radius: 16px;
    background: white;
    color: $neutral-700;
    font-size: $text-sm;
    
    &:hover {
      border-color: $primary-blue;
      color: $primary-blue;
    }
  }
}
```

### Responsive Breakpoints
```scss
$breakpoint-sm: 640px;   // Small devices
$breakpoint-md: 768px;   // Tablets
$breakpoint-lg: 1024px;  // Small desktops
$breakpoint-xl: 1280px;  // Large desktops
$breakpoint-2xl: 1536px; // Extra large screens
```

---

## User Experience Flow

### Primary User Journey

#### 1. First-Time User Onboarding
```
Landing → Welcome Message → Capability Explanation → First Search → Results → Save Option → Success
```

**Key Moments**
- Welcome: Set expectations, build trust
- First Input: Validate understanding immediately
- First Results: Wow moment with speed and accuracy
- Save Prompt: Introduce monitoring feature naturally

#### 2. Returning User Flow
```
Return → Greeting with Context → Quick Actions → Search/Saved → Results → Actions
```

**Key Moments**
- Recognition: "Welcome back! Want to check on your London trip?"
- Shortcuts: One-click access to saved searches
- Updates: Highlight any price changes immediately

### Detailed Interaction Flows

#### Search Flow State Machine
```
IDLE → LISTENING → PROCESSING → CLARIFYING → SEARCHING → RESULTS → ACTIONS
  ↑        ↓           ↓            ↓            ↓          ↓         ↓
  └────────┴───────────┴────────────┴────────────┴──────────┴─────────┘
```

#### Error States & Recovery

**Network Error**
```
Message: "I'm having trouble connecting to flight data. Let me try again..."
Action: Auto-retry with exponential backoff
Fallback: "Still having issues. You can try again in a moment, or save this search and I'll email you when results are available."
```

**No Results**
```
Message: "I couldn't find any direct flights for those dates. Here's what I can do:
• Show flights with connections
• Search nearby dates (±3 days)
• Check alternate airports
What would you prefer?"
```

**Invalid Input**
```
Message: "I'm not sure I understood that correctly. Could you clarify:
• Departure city: [captured] ✓
• Destination: [need this] ←
• Date: [captured] ✓
Just type the destination city, or click here to use the form."
```

### Loading & Transition States

#### Search Loading
```
1. Input disabled, send button becomes spinner
2. "Searching flights..." message appears with typing animation
3. Progress indicator: "Checking 5 airlines..."
4. Skeleton cards appear as results load
5. Cards animate in as data arrives
```

#### Transition Animations
- Page changes: 300ms crossfade
- New messages: slide up + fade in (200ms)
- Card appearance: stagger 50ms between cards
- Saved search confirmation: success flash + checkmark

### Success Celebrations

#### Price Drop Notification
```html
<div class="celebration celebration--price-drop">
  <div class="celebration__icon">💰</div>
  <div class="celebration__message">
    <h3>Price dropped $73!</h3>
    <p>Your London flight is now $414 (was $487)</p>
  </div>
  <button class="btn btn--primary">View Deal</button>
</div>
```

#### First Save Success
```html
<div class="celebration celebration--first-save">
  <div class="celebration__icon">🎉</div>
  <div class="celebration__message">
    <h3>Search saved successfully!</h3>
    <p>I'll check for better prices every week</p>
  </div>
</div>
```

---

## Design System Components

### Component Library

#### 1. Buttons

**Primary Button**
```scss
.btn--primary {
  background: $primary-blue;
  color: white;
  padding: $space-3 $space-5;
  border-radius: 8px;
  font-weight: $font-semibold;
  transition: all 200ms ease-out;
  
  &:hover {
    background: $primary-dark;
    transform: translateY(-1px);
    box-shadow: $shadow-md;
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:focus {
    outline: none;
    box-shadow: $shadow-focus;
  }
  
  &:disabled {
    background: $neutral-300;
    cursor: not-allowed;
  }
}
```

**Secondary Button**
```scss
.btn--secondary {
  background: white;
  color: $primary-blue;
  border: 2px solid $primary-blue;
  // ... similar states
}
```

**Ghost Button**
```scss
.btn--ghost {
  background: transparent;
  color: $neutral-700;
  // ... minimal styling
}
```

#### 2. Form Elements

**Text Input**
```scss
.input {
  width: 100%;
  padding: $space-3 $space-4;
  border: 2px solid $neutral-300;
  border-radius: 8px;
  font-size: $text-base;
  transition: border-color 200ms ease-out;
  
  &:focus {
    outline: none;
    border-color: $primary-blue;
  }
  
  &.input--error {
    border-color: $error-red;
  }
}
```

**Select Dropdown**
```scss
.select {
  appearance: none;
  background-image: url('chevron-down.svg');
  background-position: right $space-3 center;
  background-repeat: no-repeat;
  padding-right: $space-10;
  // ... inherit input styles
}
```

#### 3. Cards & Containers

**Base Card**
```scss
.card {
  background: white;
  border: 1px solid $neutral-300;
  border-radius: 8px;
  padding: $space-4;
  box-shadow: $shadow-sm;
  
  &.card--interactive {
    cursor: pointer;
    transition: all 200ms ease-out;
    
    &:hover {
      box-shadow: $shadow-md;
      transform: translateY(-2px);
    }
  }
}
```

#### 4. Badges & Tags

**Status Badge**
```scss
.badge {
  display: inline-flex;
  align-items: center;
  padding: $space-1 $space-2;
  border-radius: 12px;
  font-size: $text-xs;
  font-weight: $font-medium;
  
  &.badge--success {
    background: rgba($success-green, 0.1);
    color: $success-green;
  }
  
  &.badge--warning {
    background: rgba($warning-amber, 0.1);
    color: $warning-amber;
  }
}
```

#### 5. Loading States

**Skeleton Loader**
```scss
.skeleton {
  background: linear-gradient(
    90deg,
    $neutral-100 25%,
    $neutral-200 50%,
    $neutral-100 75%
  );
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 4px;
  
  &.skeleton--text {
    height: $text-base;
    margin: $space-2 0;
  }
  
  &.skeleton--card {
    height: 120px;
    margin: $space-3 0;
  }
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Typing Indicator**
```html
<div class="typing-indicator">
  <span></span>
  <span></span>
  <span></span>
</div>
```

```scss
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  
  span {
    width: 8px;
    height: 8px;
    background: $neutral-500;
    border-radius: 50%;
    animation: typing 1.4s infinite;
    
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes typing {
  0%, 60%, 100% { transform: scale(1); opacity: 0.5; }
  30% { transform: scale(1.3); opacity: 1; }
}
```

### Dashboard Components

#### Saved Search Card
```html
<div class="saved-search">
  <div class="saved-search__header">
    <h3>Boston → London</h3>
    <div class="saved-search__status">
      <span class="badge badge--success">Price dropped</span>
    </div>
  </div>
  
  <div class="saved-search__details">
    <div class="detail">
      <span class="label">Dates:</span>
      <span class="value">Mar 15-22</span>
    </div>
    <div class="detail">
      <span class="label">Best price:</span>
      <span class="value value--highlight">$414</span>
      <span class="change">↓ $73</span>
    </div>
    <div class="detail">
      <span class="label">Next check:</span>
      <span class="value">Tuesday</span>
    </div>
  </div>
  
  <div class="saved-search__actions">
    <button class="btn btn--ghost">View Flights</button>
    <button class="btn btn--ghost">Edit</button>
    <button class="btn btn--ghost">Delete</button>
  </div>
</div>
```

#### Quick Stats Widget
```html
<div class="stats-widget">
  <div class="stat">
    <div class="stat__value">3</div>
    <div class="stat__label">Active Searches</div>
  </div>
  <div class="stat">
    <div class="stat__value">$237</div>
    <div class="stat__label">Total Savings</div>
  </div>
  <div class="stat">
    <div class="stat__value">2 days</div>
    <div class="stat__label">Next Check</div>
  </div>
</div>
```

---

## Accessibility & Performance

### Accessibility Standards

#### WCAG 2.1 AA Compliance
- Color contrast ratios: 4.5:1 for normal text, 3:1 for large text
- All interactive elements keyboard accessible
- Focus indicators visible and clear
- Screen reader announcements for dynamic content

#### ARIA Implementation
```html
<!-- Chat message -->
<div role="log" aria-live="polite" aria-label="Chat messages">
  <div class="message message--agent" role="article">
    <span class="sr-only">Travel agent says:</span>
    <!-- message content -->
  </div>
</div>

<!-- Flight result -->
<article class="flight-card" aria-label="Flight option 1 of 3">
  <!-- content -->
</article>

<!-- Loading state -->
<div role="status" aria-live="polite">
  <span class="sr-only">Searching for flights...</span>
  <!-- visual loading indicator -->
</div>
```

#### Keyboard Navigation
- Tab order follows visual hierarchy
- Enter/Space activate buttons
- Escape closes modals/dropdowns
- Arrow keys navigate within components

### Performance Guidelines

#### Core Web Vitals Targets
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

#### Optimization Strategies
```javascript
// Lazy load images
<img loading="lazy" src="airline-logo.svg" alt="Airline">

// Virtualize long lists
const VirtualizedFlightList = ({ flights }) => {
  // Only render visible items
};

// Debounce search input
const debouncedSearch = debounce(searchFlights, 300);

// Optimize bundle size
// - Code split by route
// - Tree shake unused code
// - Minify CSS/JS
// - Compress assets
```

#### Progressive Enhancement
1. Core functionality works without JavaScript
2. Enhanced features layer on top
3. Graceful degradation for older browsers
4. Offline-first with service workers

---

## Implementation Notes

### Component Development Priority

#### Phase 1: Core Components (Week 1)
1. Message bubbles (user, agent, system)
2. Basic input area
3. Button system
4. Typography and colors

#### Phase 2: Search Components (Week 2)
1. Flight result cards
2. Loading states
3. Error messages
4. Form fallbacks

#### Phase 3: Dashboard (Week 3)
1. Saved search cards
2. Stats widget
3. Navigation
4. Responsive layout

#### Phase 4: Polish (Week 4)
1. Animations and transitions
2. Accessibility audit
3. Performance optimization
4. Cross-browser testing

### Design Tokens
```json
{
  "colors": {
    "primary": "#0066FF",
    "neutral": {
      "900": "#1A1A1A",
      "700": "#4A4A4A",
      // ... etc
    }
  },
  "spacing": {
    "1": "4px",
    "2": "8px",
    // ... etc
  },
  "typography": {
    "fontFamily": {
      "sans": "-apple-system, BlinkMacSystemFont, ..."
    },
    "fontSize": {
      "base": "16px",
      // ... etc
    }
  }
}
```

### CSS Architecture
- Use CSS Modules or styled-components
- Follow BEM naming convention
- Mobile-first responsive design
- Utility classes for common patterns

### Testing Checklist
- [ ] Cross-browser compatibility (Chrome, Safari, Firefox, Edge)
- [ ] Mobile devices (iOS Safari, Chrome Android)
- [ ] Screen readers (NVDA, JAWS, VoiceOver)
- [ ] Keyboard-only navigation
- [ ] High contrast mode
- [ ] Slow network conditions
- [ ] Error state handling
- [ ] Empty states
- [ ] Long content overflow

---

## Appendix: Design Rationale

### Why These Design Decisions?

#### Conversational UI Over Traditional Forms
- Reduces cognitive load for complex searches
- Feels more natural and engaging
- Allows progressive disclosure of options
- BUT: Always provide form fallback for accessibility

#### Limited Color Palette
- Improves focus on content
- Reduces decision fatigue
- Ensures accessibility
- Creates professional appearance

#### Card-Based Flight Results
- Scannable information hierarchy
- Mobile-friendly touch targets
- Clear visual separation
- Expandable for details

#### Personality in Error Messages
- Reduces user frustration
- Maintains engagement
- Builds trust through transparency
- Guides to resolution

### Inspiration & References
- Conversational UX: Intercom, Drift
- Flight Display: Google Flights, Kayak
- Design System: Tailwind UI, Material Design
- Personality: Slack, Mailchimp

---

*This design brief serves as the north star for creating a delightful, efficient, and accessible travel agent experience. It should be treated as a living document that evolves based on user feedback and technical constraints.*