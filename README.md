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

#### Roles

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
