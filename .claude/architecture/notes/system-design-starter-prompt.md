Okay claude. Right now we've got a simple React Native UI that is capable of setting up a Gemini Live connection, hosting a "call", maintaining that call
while the user screen is locked, and at the end of the call, displaying a transcript of the call turns, both user and agent. We also have a "Home Screen"
which displays a number of "Core Plugins". Some can launch a "Plugin Screen", but these are just empty shells in preparation for the app that we're
building.

## Core UX Considerations:

Downstream the plan is to build a general purpose, voice-first AI assistant. It should be able to build a knowledge base about a user, their interests,
work, relationships, etc. This knowledge base will begin with an "onboarding interview". And will be continuously updated with each subsequent conversation.

## This agent will be capable of executing certain tasks on behalf of the user, such as:

- Do research and prepare reading material on a particular topic
- Prepare "podcast" audio material on a particular topic
- Act as a "thought partner" for the user, helping them think through problems, connect ideas across different domains, and surface patterns they might be missing. Help build a persistent network of ideas
- Connect with user's contacts and email to draft emails
- Connect with schedule (and other resources) to produce a morning brief of what's ahead (meetings, tasks, goals) or an evening summary of what got done and what's carrying forward
- Create calendar events
- View a graph of user's personal knowledge graph
- Do repeating scheduled tasks, such as: daily brief M-F, create a "latest news" podcast every day, etc.

As a voice first agent, each Gemini Live session should have access to the user's personal knowledge graph. It can use the knowledge graph to help it perform tasks, as well as inform the conversation. For example, when starting a new session, the agent could reference recent topics of interest, recent notes, etc. to offer the user a starting point for the conversation.

## Foundational Architecture:

### Flow

1. Client-side conversational agent, powered by Gemini Live, "call" session. Calls always end with an agent summary & action items. User confirms action items before ending the call. Produces a transcript
2. Transcript sent to server. Server ai reads the transcript and adds relevant nodes to the knowledge graph
3. Server kicks off background tasks for action items, such as doing research, podcast generation, etc.
4. User recieves a notification when the background task is complete, and can view the results in the app.

### Client

- React Native with Expo
- Gemini Live conversational agent
- React Native Audio API for mic streaming, playback, and audio processing

### Server

- Nestjs + Supabase
- Langchain + Anthropic SDK for agentic workflows

Additional Considerations:

- Knowledge graph implementation needs to be sufficiently flexible to reflect the lives and use cases of all kinds of users
- It's probably a good idea to have at least two distinct sections of the knowledge graph – one where the AI stores information on behalf of the user, and one where the AI stores information _about_ the user. The latter would be for internal purposes only

I'm sure there's loads more to discuss. I've got some specific ideas about how the knowledge graph could be implemented, but I want to give you a chance to ask questions first. Let's have a socratic conversation about the app, architecture, core UX and features, and when we're ready, we'll record everything in a system spec doc.
