## Overview:

This Node.js server is designed to integrate with the OpenAI API for generating and describing images, managing asynchronous threads, and handling dynamic requests. It utilizes Express for routing, supports environmental configuration, and employs robust error handling and logging.

## Server Initialization:

- The server listens on a configurable port and uses environmental variables for settings like API keys.

```
OPENAI_API_KEY=sk-proj-<project-key>
POSTS_ASSISTANT=asst_gN17ebClyJwaXaD7WI6YvTnt
ROLES_ASSISTANT=asst_KbMKmuz8N5nijYH8ucI0wEYV
```

## Endpoints

### Testing

Created a shared Postman to make it easier to use pm global variables to carry over image description thread and run id etc between role and posts requests. also check out the visualized tab to see the images after request completes

https://lunar-flare-318307.postman.co/workspace/New-Team-Workspace~f485e9c5-cd10-4103-9d52-dd19dddf2810/collection/34897079-e3fca786-4916-40ff-80f8-8b709022f18f?action=share&creator=34897079#### Roles

```
 curl -X POST http://localhost:3000/api/assist -H "Content-Type: application/json" -d '{"message": "Club Name: Vampires of Brooklyn Interests: ASMR, Blockchain, Cottage Core", "assistant": "roles"}'
```

#### Posts

```
curl -X POST http://localhost:3000/api/assist \
-H "Content-Type: application/json" \
-d "{ \
  \"message\": \"'Time hook: Crying, Place: Empire State Building'\", \
  \"assistant\": \"posts\", \
  \"imageDescription\": \"<role-image-descripion-from-roles-response>\" \
}"
```
