# Twitter-like App Specification

## Problem

People want to share short messages and consume a feed of content from people they follow on a public social platform.

The goal is to build an MVP that provides the core social networking experience without unnecessary features or complexity.

## Product context

The application is a public social network inspired by Twitter/X.

Users create an account, follow other users, publish short messages called **tweets**, and interact with tweets from people they follow.

A typical user journey is:

1. A user creates an account and logs in.
2. They discover other users and follow them.
3. They see tweets from the users they follow in their home feed.
4. They publish their own tweets.
5. Other users can like, reply to, or repost their tweets.
6. Users receive notifications when others interact with their content or follow them.

The initial target is an MVP, but the architecture should avoid decisions that would prevent the application from scaling in the future.

## Goal

Build a web and mobile-friendly application inspired by Twitter where users can:

- Create accounts.
- Publish short tweets.
- Follow and unfollow users.
- Like tweets.
- Reply to tweets.
- Repost tweets.
- Search for users and tweets.
- Receive notifications about relevant interactions.

## Core Features

### Users

Users must be able to:

- Create an account with a username, email, and password.
- Log in and log out.
- Change their password.
- View and edit their profile.
- View other users' profiles.
- Follow and unfollow other users.

A profile should display:

- Username.
- Display name.
- Bio.
- Number of followers.
- Number of following.
- User's tweets.

### Tweets

Users can create tweets containing up to **250 characters**.

Each tweet contains:

- Author.
- Content.
- Creation timestamp.
- Like count.
- Reply count.
- Repost count.

Users can:

- Create tweets.
- Delete their own tweets.
- Like and unlike tweets.
- Reply to tweets.
- Repost tweets.

A user must not be able to delete another user's tweet.

### Following

A logged-in user can follow and unfollow other users.

The following rules apply:

- A user cannot follow themselves.
- Following the same user multiple times must not create duplicate relationships.
- Unfollowing a user removes the existing relationship.

### Feed

When a user is logged in, their home feed displays tweets from:

- Users they follow.
- Themselves.

Tweets should be ordered from newest to oldest.

Users must not see tweets from users they do not follow in their home feed.

New tweets should be propagated to relevant users in real time.

### Search

Users can search for:

- Users by username or display name.
- Tweets by content.

### Notifications

Users should receive notifications for:

- New followers.
- Likes on their tweets.
- Replies to their tweets.
- Reposts of their tweets.

Notifications should be accessible from the main navigation.

## Groups

Users should be able to create and join groups based on shared interests.

A group should have:

- Name.
- Description.
- Members.

Group members can publish content inside the group.

For the MVP, group posts may contain text only.

Groups should be isolated from the main user feed unless the user is a member of the group.

## UI and User Experience

The application should have a clean and modern interface inspired by Twitter/X without copying its branding.

The main navigation should provide access to:

- Home.
- Search.
- Notifications.
- Profile.

The application should be responsive and usable on both desktop and mobile devices.

The UI should provide appropriate:

- Loading states.
- Empty states.
- Error states.
- Form validation feedback.

## Authentication and Security

- Passwords must never be stored in plain text.
- Users can only modify or delete their own content.
- Authenticated functionality must require authentication.
- Account and password changes must require an authenticated session.
- User input must be validated on the server side.
- Unauthorized users must not be able to access another user's private account functionality.

## Data Persistence

The following data must persist between application restarts:

- Users.
- Profiles.
- Tweets.
- Replies.
- Likes.
- Reposts.
- Follows.
- Groups.
- Group memberships.
- Notifications.

## Scalability and Availability

The application should be designed with future scalability in mind.

The architecture should support:

- Horizontal scaling.
- Distributed application instances.
- Caching where appropriate.
- High availability.
- Real-time message propagation.

The target production architecture should be capable of supporting millions of users and a five-nines availability target.

These requirements should not introduce unnecessary complexity into the MVP implementation.

## Out of Scope

The following features are explicitly out of scope for this MVP:

- Direct messaging.
- Advertising.
- Monetization.
- Advanced recommendation algorithms.
- Advanced content moderation.
- Video and audio uploads.
- Audio messages.
- Private groups.
- Live streaming.

## Acceptance Criteria

The implementation is complete when:

- A user can sign up, log in, and log out.
- A user can create a tweet of up to 250 characters.
- A user can delete their own tweets but not other users' tweets.
- Users can follow and unfollow other users.
- A user cannot follow themselves or create duplicate follows.
- The timeline correctly displays tweets from followed users and the current user.
- New tweets are propagated to relevant users in real time.
- Users can like, reply to, and repost tweets.
- User and tweet search works.
- Notifications are generated for the specified interactions.
- Users can create and join groups.
- Group members can publish text posts in groups.
- Profiles display the correct information and tweets.
- Data persists between application restarts.
- The application works on desktop and mobile.
- Loading, empty, and error states are handled.
- Authentication and authorization rules are enforced.

## Implementation

Choose the appropriate technologies, architecture, database, and project structure based on the requirements above.

Prioritize:

1. Correctness.
2. Simplicity.
3. Maintainability.
4. Clear separation of concerns.
5. Scalability where it does not unnecessarily complicate the MVP.

Before implementing, inspect the existing project structure and reuse existing patterns where appropriate.

Do not implement features that are explicitly out of scope.

Where the specification does not define an implementation detail, choose a sensible solution rather than blocking on clarification.