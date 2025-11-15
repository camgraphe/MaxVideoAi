# Pika Text to Video (v2.2)

> Pika v2.2 creates videos from a text prompt with high quality output.


## Overview

- **Endpoint**: `https://fal.run/fal-ai/pika/v2.2/text-to-video`
- **Model ID**: `fal-ai/pika/v2.2/text-to-video`
- **Category**: text-to-video
- **Kind**: inference
**Tags**: editing, effects, animation



## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`prompt`** (`string`, _required_)
  - Examples: "Sunlight streams down on a woman with flowing auburn hair as she runs effortlessly along a tree-lined street, her joyous expression reflecting the freedom of the moment; the simple, steady camerawork emphasizes her grace and the beauty of the everyday."

- **`seed`** (`integer`, _optional_):
  The seed for the random number generator

- **`negative_prompt`** (`string`, _optional_):
  A negative prompt to guide the model Default value: `""`
  - Default: `""`

- **`aspect_ratio`** (`AspectRatioEnum`, _optional_):
  The aspect ratio of the generated video Default value: `"16:9"`
  - Default: `"16:9"`
  - Options: `"16:9"`, `"9:16"`, `"1:1"`, `"4:5"`, `"5:4"`, `"3:2"`, `"2:3"`

- **`resolution`** (`ResolutionEnum`, _optional_):
  The resolution of the generated video Default value: `"720p"`
  - Default: `"720p"`
  - Options: `"720p"`, `"1080p"`

- **`duration`** (`integer`, _optional_):
  The duration of the generated video in seconds Default value: `5`
  - Default: `5`



**Required Parameters Example**:

```json
{
  "prompt": "Sunlight streams down on a woman with flowing auburn hair as she runs effortlessly along a tree-lined street, her joyous expression reflecting the freedom of the moment; the simple, steady camerawork emphasizes her grace and the beauty of the everyday."
}
```

**Full Example**:

```json
{
  "prompt": "Sunlight streams down on a woman with flowing auburn hair as she runs effortlessly along a tree-lined street, her joyous expression reflecting the freedom of the moment; the simple, steady camerawork emphasizes her grace and the beauty of the everyday.",
  "aspect_ratio": "16:9",
  "resolution": "720p",
  "duration": 5
}
```


### Output Schema

The API returns the following output format:

- **`video`** (`File`, _required_):
  The generated video
  - Examples: {"url":"https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/text-to-video-output.mp4"}



**Example Response**:

```json
{
  "video": {
    "url": "https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/text-to-video-output.mp4"
  }
}
```



### Pricing

| Parameter | Value |
|------------|--------|
| **Unit** | per 5s clip |
| **Price** | $0.20 (720p) / $0.45 (1080p) |
| **Notes** | Listed on fal.ai model page |
| **Source** | [Fal.ai – Pika v2.2 Text to Video](https://fal.ai/models/fal-ai/pika/v2.2/text-to-video) |

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/pika/v2.2/text-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "Sunlight streams down on a woman with flowing auburn hair as she runs effortlessly along a tree-lined street, her joyous expression reflecting the freedom of the moment; the simple, steady camerawork emphasizes her grace and the beauty of the everyday."
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/pika/v2.2/text-to-video",
    arguments={
        "prompt": "Sunlight streams down on a woman with flowing auburn hair as she runs effortlessly along a tree-lined street, her joyous expression reflecting the freedom of the moment; the simple, steady camerawork emphasizes her grace and the beauty of the everyday."
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/pika/v2.2/text-to-video", {
  input: {
    prompt: "Sunlight streams down on a woman with flowing auburn hair as she runs effortlessly along a tree-lined street, her joyous expression reflecting the freedom of the moment; the simple, steady camerawork emphasizes her grace and the beauty of the everyday."
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/pika/v2.2/text-to-video)
- [API Documentation](https://fal.ai/models/fal-ai/pika/v2.2/text-to-video/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/pika/v2.2/text-to-video)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)




# Pika Image to Video (v2.2)

> Pika v2.2 creates videos from images with high quality output.


## Overview

- **Endpoint**: `https://fal.run/fal-ai/pika/v2.2/image-to-video`
- **Model ID**: `fal-ai/pika/v2.2/image-to-video`
- **Category**: image-to-video
- **Kind**: inference
**Tags**: editing, effects, animation



## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`image_url`** (`string`, _required_):
  URL of the image to use as the first frame
  - Examples: "https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika_input.png"

- **`prompt`** (`string`, _required_)
  - Examples: "a woman looking into camera slowly smiling"

- **`seed`** (`integer`, _optional_):
  The seed for the random number generator

- **`negative_prompt`** (`string`, _optional_):
  A negative prompt to guide the model Default value: `""`
  - Default: `""`

- **`resolution`** (`ResolutionEnum`, _optional_):
  The resolution of the generated video Default value: `"720p"`
  - Default: `"720p"`
  - Options: `"720p"`, `"1080p"`

- **`duration`** (`integer`, _optional_):
  The duration of the generated video in seconds Default value: `5`
  - Default: `5`



**Required Parameters Example**:

```json
{
  "image_url": "https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika_input.png",
  "prompt": "a woman looking into camera slowly smiling"
}
```

**Full Example**:

```json
{
  "image_url": "https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika_input.png",
  "prompt": "a woman looking into camera slowly smiling",
  "resolution": "720p",
  "duration": 5
}
```


### Output Schema

The API returns the following output format:

- **`video`** (`File`, _required_):
  The generated video
  - Examples: {"url":"https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika22_output.mp4"}



**Example Response**:

```json
{
  "video": {
    "url": "https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika22_output.mp4"
  }
}
```



### Pricing

| Parameter | Value |
|------------|--------|
| **Unit** | per 5s clip |
| **Price** | $0.20 (720p) / $0.45 (1080p) |
| **Notes** | Listed on fal.ai model page |
| **Source** | [Fal.ai – Pika v2.2 Image to Video](https://fal.ai/models/fal-ai/pika/v2.2/image-to-video) |

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/pika/v2.2/image-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "image_url": "https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika_input.png",
     "prompt": "a woman looking into camera slowly smiling"
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/pika/v2.2/image-to-video",
    arguments={
        "image_url": "https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika_input.png",
        "prompt": "a woman looking into camera slowly smiling"
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/pika/v2.2/image-to-video", {
  input: {
    image_url: "https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika_input.png",
    prompt: "a woman looking into camera slowly smiling"
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/pika/v2.2/image-to-video)
- [API Documentation](https://fal.ai/models/fal-ai/pika/v2.2/image-to-video/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/pika/v2.2/image-to-video)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)





# Veo 3.1

> Generate Videos from images using Google's Veo 3.1


## Overview

- **Endpoint**: `https://fal.run/fal-ai/veo3.1/reference-to-video`
- **Model ID**: `fal-ai/veo3.1/reference-to-video`
- **Category**: image-to-video
- **Kind**: inference


## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`image_urls`** (`list<string>`, _required_):
  URLs of the reference images to use for consistent subject appearance
  - Array of string
  - Examples: ["https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-1.png","https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-2.png","https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-3.png"]

- **`prompt`** (`string`, _required_):
  The text prompt describing the video you want to generate
  - Examples: "A graceful ballerina dancing outside a circus tent on green grass, with colorful wildflowers swaying around her as she twirls and poses in the meadow."

- **`duration`** (`DurationEnum`, _optional_):
  The duration of the generated video in seconds Default value: `"8s"`
  - Default: `"8s"`
  - Options: `"8s"`

- **`resolution`** (`ResolutionEnum`, _optional_):
  Resolution of the generated video Default value: `"720p"`
  - Default: `"720p"`
  - Options: `"720p"`, `"1080p"`

- **`generate_audio`** (`boolean`, _optional_):
  Whether to generate audio for the video. If false, %33 less credits will be used. Default value: `true`
  - Default: `true`



**Required Parameters Example**:

```json
{
  "image_urls": [
    "https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-1.png",
    "https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-2.png",
    "https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-3.png"
  ],
  "prompt": "A graceful ballerina dancing outside a circus tent on green grass, with colorful wildflowers swaying around her as she twirls and poses in the meadow."
}
```

**Full Example**:

```json
{
  "image_urls": [
    "https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-1.png",
    "https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-2.png",
    "https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-3.png"
  ],
  "prompt": "A graceful ballerina dancing outside a circus tent on green grass, with colorful wildflowers swaying around her as she twirls and poses in the meadow.",
  "duration": "8s",
  "resolution": "720p",
  "generate_audio": true
}
```


### Output Schema

The API returns the following output format:

- **`video`** (`File`, _required_):
  The generated video
  - Examples: {"url":"https://storage.googleapis.com/falserverless/example_outputs/veo31-r2v-output.mp4"}



**Example Response**:

```json
{
  "video": {
    "url": "https://storage.googleapis.com/falserverless/example_outputs/veo31-r2v-output.mp4"
  }
}
```



### Pricing

| Parameter | Value |
|------------|--------|
| **Unit** | per second |
| **Price** | $0.20/s (audio off) / $0.40/s (audio on) |
| **Notes** | Listed on fal.ai model page |
| **Source** | [Fal.ai – Veo 3.1 Reference-to-Video](https://fal.ai/models/fal-ai/veo3.1/reference-to-video) |

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/veo3.1/reference-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "image_urls": [
       "https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-1.png",
       "https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-2.png",
       "https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-3.png"
     ],
     "prompt": "A graceful ballerina dancing outside a circus tent on green grass, with colorful wildflowers swaying around her as she twirls and poses in the meadow."
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/veo3.1/reference-to-video",
    arguments={
        "image_urls": ["https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-1.png", "https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-2.png", "https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-3.png"],
        "prompt": "A graceful ballerina dancing outside a circus tent on green grass, with colorful wildflowers swaying around her as she twirls and poses in the meadow."
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/veo3.1/reference-to-video", {
  input: {
    image_urls: ["https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-1.png", "https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-2.png", "https://storage.googleapis.com/falserverless/example_inputs/veo31-r2v-input-3.png"],
    prompt: "A graceful ballerina dancing outside a circus tent on green grass, with colorful wildflowers swaying around her as she twirls and poses in the meadow."
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/veo3.1/reference-to-video)
- [API Documentation](https://fal.ai/models/fal-ai/veo3.1/reference-to-video/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/veo3.1/reference-to-video)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)




# Veo 3 Fast

> Faster and more cost effective version of Google's Veo 3! 


## Overview

- **Endpoint**: `https://fal.run/fal-ai/veo3/fast`
- **Model ID**: `fal-ai/veo3/fast`
- **Category**: text-to-video
- **Kind**: inference


## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`prompt`** (`string`, _required_):
  The text prompt describing the video you want to generate
  - Examples: "A casual street interview on a busy New York City sidewalk in the afternoon. The interviewer holds a plain, unbranded microphone and asks: Have you seen Google's new Veo3 model It is a super good model. Person replies: Yeah I saw it, it's already available on fal. It's crazy good."

- **`aspect_ratio`** (`AspectRatioEnum`, _optional_):
  The aspect ratio of the generated video. If it is set to 1:1, the video will be outpainted. Default value: `"16:9"`
  - Default: `"16:9"`
  - Options: `"9:16"`, `"16:9"`, `"1:1"`

- **`duration`** (`DurationEnum`, _optional_):
  The duration of the generated video in seconds Default value: `"8s"`
  - Default: `"8s"`
  - Options: `"4s"`, `"6s"`, `"8s"`

- **`negative_prompt`** (`string`, _optional_):
  A negative prompt to guide the video generation

- **`enhance_prompt`** (`boolean`, _optional_):
  Whether to enhance the video generation Default value: `true`
  - Default: `true`

- **`seed`** (`integer`, _optional_):
  A seed to use for the video generation

- **`auto_fix`** (`boolean`, _optional_):
  Whether to automatically attempt to fix prompts that fail content policy or other validation checks by rewriting them Default value: `true`
  - Default: `true`

- **`resolution`** (`ResolutionEnum`, _optional_):
  The resolution of the generated video Default value: `"720p"`
  - Default: `"720p"`
  - Options: `"720p"`, `"1080p"`

- **`generate_audio`** (`boolean`, _optional_):
  Whether to generate audio for the video. If false, %33 less credits will be used. Default value: `true`
  - Default: `true`



**Required Parameters Example**:

```json
{
  "prompt": "A casual street interview on a busy New York City sidewalk in the afternoon. The interviewer holds a plain, unbranded microphone and asks: Have you seen Google's new Veo3 model It is a super good model. Person replies: Yeah I saw it, it's already available on fal. It's crazy good."
}
```

**Full Example**:

```json
{
  "prompt": "A casual street interview on a busy New York City sidewalk in the afternoon. The interviewer holds a plain, unbranded microphone and asks: Have you seen Google's new Veo3 model It is a super good model. Person replies: Yeah I saw it, it's already available on fal. It's crazy good.",
  "aspect_ratio": "16:9",
  "duration": "8s",
  "enhance_prompt": true,
  "auto_fix": true,
  "resolution": "720p",
  "generate_audio": true
}
```


### Output Schema

The API returns the following output format:

- **`video`** (`File`, _required_):
  The generated video
  - Examples: {"url":"https://v3.fal.media/files/penguin/Q-2dpcjIoQOldJRL3grsc_output.mp4"}



**Example Response**:

```json
{
  "video": {
    "url": "https://v3.fal.media/files/penguin/Q-2dpcjIoQOldJRL3grsc_output.mp4"
  }
}
```



### Pricing

| Parameter | Value |
|------------|--------|
| **Unit** | per second |
| **Price** | $0.25/s (audio off) / $0.40/s (audio on) |
| **Notes** | Listed on fal.ai model page |
| **Source** | [Fal.ai – Veo 3 Fast](https://fal.ai/models/fal-ai/veo3/fast) |

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/veo3/fast \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "A casual street interview on a busy New York City sidewalk in the afternoon. The interviewer holds a plain, unbranded microphone and asks: Have you seen Google's new Veo3 model It is a super good model. Person replies: Yeah I saw it, it's already available on fal. It's crazy good."
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/veo3/fast",
    arguments={
        "prompt": "A casual street interview on a busy New York City sidewalk in the afternoon. The interviewer holds a plain, unbranded microphone and asks: Have you seen Google's new Veo3 model It is a super good model. Person replies: Yeah I saw it, it's already available on fal. It's crazy good."
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/veo3/fast", {
  input: {
    prompt: "A casual street interview on a busy New York City sidewalk in the afternoon. The interviewer holds a plain, unbranded microphone and asks: Have you seen Google's new Veo3 model It is a super good model. Person replies: Yeah I saw it, it's already available on fal. It's crazy good."
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/veo3/fast)
- [API Documentation](https://fal.ai/models/fal-ai/veo3/fast/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/veo3/fast)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)


# Veo 3.1 Fast

> Generate videos from a single reference image using Google's Veo 3.1 Fast


## Overview

- **Endpoint**: `https://fal.run/fal-ai/veo3.1/fast/image-to-video`
- **Model ID**: `fal-ai/veo3.1/fast/image-to-video`
- **Category**: image-to-video
- **Kind**: inference


## API Information

This model can be used via our HTTP API or client libraries. See the schema below plus usage examples.


### Input Schema

- **`prompt`** (`string`, _required_): Describe how the still image should animate.
- **`image_url`** (`string`, _required_): URL to the source image (720p+ recommended).
- **`duration`** (`DurationEnum`, _optional_): `"4s"`, `"6s"`, or `"8s"` (default `"8s"`).
- **`aspect_ratio`** (`AspectRatioEnum`, _optional_): `"auto"` (default), `"9:16"`, `"16:9"`, `"1:1"`.
- **`resolution`** (`ResolutionEnum`, _optional_): `"720p"` (default) or `"1080p"`.
- **`generate_audio`** (`boolean`, _optional_): Defaults to `true`. Disable to save ~33% credits.


**Required Parameters Example**:

```json
{
  "prompt": "A woman looks into the camera, smiles, then exclaims: \"have you seen Veo 3.1 Fast image-to-video on Fal?\"",
  "image_url": "https://storage.googleapis.com/falserverless/example_inputs/veo3-i2v-input.png"
}
```

**Full Example**:

```json
{
  "prompt": "A woman looks into the camera, smiles, then exclaims: \"have you seen Veo 3.1 Fast image-to-video on Fal?\"",
  "image_url": "https://storage.googleapis.com/falserverless/example_inputs/veo3-i2v-input.png",
  "duration": "8s",
  "aspect_ratio": "auto",
  "resolution": "720p",
  "generate_audio": true
}
```


### Output Schema

The API returns the following output format:

- **`video`** (`File`, _required_):
  The generated video
  - Examples: {"url":"https://storage.googleapis.com/falserverless/example_outputs/veo31-flf2v-output.mp4"}



**Example Response**:

```json
{
  "video": {
    "url": "https://storage.googleapis.com/falserverless/example_outputs/veo31-flf2v-output.mp4"
  }
}
```



### Pricing

| Parameter | Value |
|------------|--------|
| **Unit** | per second |
| **Price** | $0.10/s (audio off) / $0.15/s (audio on) |
| **Notes** | Listed on fal.ai model page |
| **Source** | [Fal.ai – Veo 3.1 Fast Image-to-Video](https://fal.ai/models/fal-ai/veo3.1/fast/image-to-video) |

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/veo3.1/fast/image-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "A woman looks into the camera, smiles, then shouts: \"have you tried Veo3.1 Fast image-to-video on Fal?\"",
     "image_url": "https://storage.googleapis.com/falserverless/example_inputs/veo3-i2v-input.png"
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/veo3.1/fast/image-to-video",
    arguments={
        "prompt": "A woman looks into the camera, smiles, then shouts: \"have you tried Veo3.1 Fast image-to-video on Fal?\"",
        "image_url": "https://storage.googleapis.com/falserverless/example_inputs/veo3-i2v-input.png"
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/veo3.1/fast/image-to-video", {
  input: {
    prompt: "A woman looks into the camera, smiles, then shouts: \"have you tried Veo3.1 Fast image-to-video on Fal?\"",
    image_url: "https://storage.googleapis.com/falserverless/example_inputs/veo3-i2v-input.png"
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/veo3.1/fast/image-to-video)
- [API Documentation](https://fal.ai/models/fal-ai/veo3.1/fast/image-to-video/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/veo3.1/fast/image-to-video)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)





# Sora 2 · Text to Video

> Text-to-video endpoint for Sora 2, OpenAI's state-of-the-art video model capable of creating richly detailed, dynamic clips with audio from natural language or images.

> **Integration note (MaxVideoAi):** the production app expects Fal callbacks to hit `/api/fal/webhook` with the `token` query parameter. Keep `FAL_WEBHOOK_TOKEN` in sync with the webhook URL we register on Fal to avoid missing status updates.

## Overview

- **Endpoint**: `https://fal.run/fal-ai/sora-2/text-to-video`
- **Model ID**: `fal-ai/sora-2/text-to-video`
- **Category**: text-to-video
- **Kind**: inference
**Tags**: text to video, audio, sora



## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`api_key`** (`string`, _optional_):
  The API key to use for the OpenAI API. If provided, you will not be billed for the request.

- **`prompt`** (`string`, _required_):
  The text prompt describing the video you want to generate
  - Examples: "A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue. Cinematic lighting, warm sunset tones, shallow depth of field, gentle breeze moving autumn leaves, realistic natural sound, no background music"

- **`resolution`** (`ResolutionEnum`, _optional_):
  The resolution of the generated video Default value: `"720p"`
  - Default: `"720p"`
  - Options: `"720p"`

- **`aspect_ratio`** (`AspectRatioEnum`, _optional_):
  The aspect ratio of the generated video Default value: `"16:9"`
  - Default: `"16:9"`
  - Options: `"9:16"`, `"16:9"`

- **`duration`** (`DurationEnum`, _optional_):
  Duration of the generated video in seconds Default value: `"4"`
  - Default: `4`
  - Options: `4`, `8`, `12`



**Required Parameters Example**:

```json
{
  "prompt": "A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue. Cinematic lighting, warm sunset tones, shallow depth of field, gentle breeze moving autumn leaves, realistic natural sound, no background music"
}
```

**Full Example**:

```json
{
  "prompt": "A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue. Cinematic lighting, warm sunset tones, shallow depth of field, gentle breeze moving autumn leaves, realistic natural sound, no background music",
  "resolution": "720p",
  "aspect_ratio": "16:9",
  "duration": 4
}
```


### Output Schema

The API returns the following output format:

- **`video`** (`VideoFile`, _required_):
  The generated video
  - Examples: {"content_type":"video/mp4","url":"https://storage.googleapis.com/falserverless/example_outputs/sora_t2v_output.mp4"}

- **`video_id`** (`string`, _required_):
  The ID of the generated video
  - Examples: "video_123"



**Example Response**:

```json
{
  "video": {
    "content_type": "video/mp4",
    "url": "https://storage.googleapis.com/falserverless/example_outputs/sora_t2v_output.mp4"
  },
  "video_id": "video_123"
}
```



### Pricing

| Parameter | Value |
|------------|--------|
| **Unit** | per second |
| **Price** | $0.10/s |
| **Notes** | Listed on fal.ai model page |
| **Source** | [Fal.ai – Sora 2 Text to Video](https://fal.ai/models/fal-ai/sora-2/text-to-video) |

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/sora-2/text-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue. Cinematic lighting, warm sunset tones, shallow depth of field, gentle breeze moving autumn leaves, realistic natural sound, no background music"
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/sora-2/text-to-video",
    arguments={
        "prompt": "A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue. Cinematic lighting, warm sunset tones, shallow depth of field, gentle breeze moving autumn leaves, realistic natural sound, no background music"
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/sora-2/text-to-video", {
  input: {
    prompt: "A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue. Cinematic lighting, warm sunset tones, shallow depth of field, gentle breeze moving autumn leaves, realistic natural sound, no background music"
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/sora-2/text-to-video)
- [API Documentation](https://fal.ai/models/fal-ai/sora-2/text-to-video/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/sora-2/text-to-video)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)




# Sora 2 · Image to Video

> Image-to-video endpoint for Sora 2, OpenAI's state-of-the-art video model capable of creating richly detailed, dynamic clips with audio from natural language or images.


## Overview

- **Endpoint**: `https://fal.run/fal-ai/sora-2/image-to-video`
- **Model ID**: `fal-ai/sora-2/image-to-video`
- **Category**: image-to-video
- **Kind**: inference
**Tags**: image-to-video, audio, sora



## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`api_key`** (`string`, _optional_):
  The API key to use for the OpenAI API. If provided, you will not be billed for the request.

- **`prompt`** (`string`, _required_):
  The text prompt describing the video you want to generate
  - Examples: "Front-facing 'invisible' action-cam on a skydiver in freefall above bright clouds; camera locked on his face. He speaks over the wind with clear lipsync: 'This is insanely fun! You've got to try it—book a tandem and go!' Natural wind roar, voice close-mic'd and slightly compressed so it's intelligible. Midday sun, goggles and jumpsuit flutter, altimeter visible, parachute rig on shoulders. Energetic but stable framing with subtle shake; brief horizon roll. End on first tug of canopy and wind noise dropping."

- **`resolution`** (`ResolutionEnum`, _optional_):
  The resolution of the generated video Default value: `"auto"`
  - Default: `"auto"`
  - Options: `"auto"`, `"720p"`

- **`aspect_ratio`** (`AspectRatioEnum`, _optional_):
  The aspect ratio of the generated video Default value: `"auto"`
  - Default: `"auto"`
  - Options: `"auto"`, `"9:16"`, `"16:9"`

- **`duration`** (`DurationEnum`, _optional_):
  Duration of the generated video in seconds Default value: `"4"`
  - Default: `4`
  - Options: `4`, `8`, `12`

- **`image_url`** (`string`, _required_):
  The URL of the image to use as the first frame
  - Examples: "https://storage.googleapis.com/falserverless/example_inputs/sora-2-i2v-input.png"



**Required Parameters Example**:

```json
{
  "prompt": "Front-facing 'invisible' action-cam on a skydiver in freefall above bright clouds; camera locked on his face. He speaks over the wind with clear lipsync: 'This is insanely fun! You've got to try it—book a tandem and go!' Natural wind roar, voice close-mic'd and slightly compressed so it's intelligible. Midday sun, goggles and jumpsuit flutter, altimeter visible, parachute rig on shoulders. Energetic but stable framing with subtle shake; brief horizon roll. End on first tug of canopy and wind noise dropping.",
  "image_url": "https://storage.googleapis.com/falserverless/example_inputs/sora-2-i2v-input.png"
}
```

**Full Example**:

```json
{
  "prompt": "Front-facing 'invisible' action-cam on a skydiver in freefall above bright clouds; camera locked on his face. He speaks over the wind with clear lipsync: 'This is insanely fun! You've got to try it—book a tandem and go!' Natural wind roar, voice close-mic'd and slightly compressed so it's intelligible. Midday sun, goggles and jumpsuit flutter, altimeter visible, parachute rig on shoulders. Energetic but stable framing with subtle shake; brief horizon roll. End on first tug of canopy and wind noise dropping.",
  "resolution": "auto",
  "aspect_ratio": "auto",
  "duration": 4,
  "image_url": "https://storage.googleapis.com/falserverless/example_inputs/sora-2-i2v-input.png"
}
```


### Output Schema

The API returns the following output format:

- **`video`** (`VideoFile`, _required_):
  The generated video
  - Examples: {"content_type":"video/mp4","url":"https://storage.googleapis.com/falserverless/example_outputs/sora_2_i2v_output.mp4"}

- **`video_id`** (`string`, _required_):
  The ID of the generated video
  - Examples: "video_123"



**Example Response**:

```json
{
  "video": {
    "content_type": "video/mp4",
    "url": "https://storage.googleapis.com/falserverless/example_outputs/sora_2_i2v_output.mp4"
  },
  "video_id": "video_123"
}
```



### Pricing

| Parameter | Value |
|------------|--------|
| **Unit** | per second |
| **Price** | $0.10/s |
| **Notes** | Listed on fal.ai model page |
| **Source** | [Fal.ai – Sora 2 Image to Video](https://fal.ai/models/fal-ai/sora-2/image-to-video) |

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/sora-2/image-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "Front-facing 'invisible' action-cam on a skydiver in freefall above bright clouds; camera locked on his face. He speaks over the wind with clear lipsync: 'This is insanely fun! You've got to try it—book a tandem and go!' Natural wind roar, voice close-mic'd and slightly compressed so it's intelligible. Midday sun, goggles and jumpsuit flutter, altimeter visible, parachute rig on shoulders. Energetic but stable framing with subtle shake; brief horizon roll. End on first tug of canopy and wind noise dropping.",
     "image_url": "https://storage.googleapis.com/falserverless/example_inputs/sora-2-i2v-input.png"
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/sora-2/image-to-video",
    arguments={
        "prompt": "Front-facing 'invisible' action-cam on a skydiver in freefall above bright clouds; camera locked on his face. He speaks over the wind with clear lipsync: 'This is insanely fun! You've got to try it—book a tandem and go!' Natural wind roar, voice close-mic'd and slightly compressed so it's intelligible. Midday sun, goggles and jumpsuit flutter, altimeter visible, parachute rig on shoulders. Energetic but stable framing with subtle shake; brief horizon roll. End on first tug of canopy and wind noise dropping.",
        "image_url": "https://storage.googleapis.com/falserverless/example_inputs/sora-2-i2v-input.png"
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/sora-2/image-to-video", {
  input: {
    prompt: "Front-facing 'invisible' action-cam on a skydiver in freefall above bright clouds; camera locked on his face. He speaks over the wind with clear lipsync: 'This is insanely fun! You've got to try it—book a tandem and go!' Natural wind roar, voice close-mic'd and slightly compressed so it's intelligible. Midday sun, goggles and jumpsuit flutter, altimeter visible, parachute rig on shoulders. Energetic but stable framing with subtle shake; brief horizon roll. End on first tug of canopy and wind noise dropping.",
    image_url: "https://storage.googleapis.com/falserverless/example_inputs/sora-2-i2v-input.png"
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/sora-2/image-to-video)
- [API Documentation](https://fal.ai/models/fal-ai/sora-2/image-to-video/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/sora-2/image-to-video)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)



# Sora 2 Pro · Text to Video

> Text-to-video endpoint for Sora 2 Pro, OpenAI's state-of-the-art video model capable of creating richly detailed, dynamic clips with audio from natural language or images.

> **Integration note (MaxVideoAi):** Ensure Fal callbacks include the `token` query parameter when `FAL_WEBHOOK_TOKEN` is set; otherwise `/api/fal/webhook` will return 401 and jobs remain in `running`.

## Overview

- **Endpoint**: `https://fal.run/fal-ai/sora-2/text-to-video/pro`
- **Model ID**: `fal-ai/sora-2/text-to-video/pro`
- **Category**: text-to-video
- **Kind**: inference
**Tags**: text-to-video, audio, sora-2-pro



## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`api_key`** (`string`, _optional_):
  The API key to use for the OpenAI API. If provided, you will not be billed for the request.

- **`prompt`** (`string`, _required_):
  The text prompt describing the video you want to generate
  - Examples: "A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue. Cinematic lighting, warm sunset tones, shallow depth of field, gentle breeze moving autumn leaves, realistic natural sound, no background music"

- **`resolution`** (`ResolutionEnum`, _optional_):
  The resolution of the generated video Default value: `"1080p"`
  - Default: `"1080p"`
  - Options: `"720p"`, `"1080p"`

- **`aspect_ratio`** (`AspectRatioEnum`, _optional_):
  The aspect ratio of the generated video Default value: `"16:9"`
  - Default: `"16:9"`
  - Options: `"9:16"`, `"16:9"`

- **`duration`** (`DurationEnum`, _optional_):
  Duration of the generated video in seconds Default value: `"4"`
  - Default: `4`
  - Options: `4`, `8`, `12`



**Required Parameters Example**:

```json
{
  "prompt": "A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue. Cinematic lighting, warm sunset tones, shallow depth of field, gentle breeze moving autumn leaves, realistic natural sound, no background music"
}
```

**Full Example**:

```json
{
  "prompt": "A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue. Cinematic lighting, warm sunset tones, shallow depth of field, gentle breeze moving autumn leaves, realistic natural sound, no background music",
  "resolution": "1080p",
  "aspect_ratio": "16:9",
  "duration": 4
}
```


### Output Schema

The API returns the following output format:

- **`video`** (`VideoFile`, _required_):
  The generated video
  - Examples: {"content_type":"video/mp4","url":"https://storage.googleapis.com/falserverless/example_outputs/sora-2-pro-t2v-output.mp4"}

- **`video_id`** (`string`, _required_):
  The ID of the generated video
  - Examples: "video_123"



**Example Response**:

```json
{
  "video": {
    "content_type": "video/mp4",
    "url": "https://storage.googleapis.com/falserverless/example_outputs/sora-2-pro-t2v-output.mp4"
  },
  "video_id": "video_123"
}
```



### Pricing

| Parameter | Value |
|------------|--------|
| **Unit** | per second |
| **Price** | $0.30/s (720p) / $0.50/s (1080p) |
| **Notes** | Listed on fal.ai model page |
| **Source** | [Fal.ai – Sora 2 Pro Text to Video](https://fal.ai/models/fal-ai/sora-2/text-to-video/pro) |

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/sora-2/text-to-video/pro \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue. Cinematic lighting, warm sunset tones, shallow depth of field, gentle breeze moving autumn leaves, realistic natural sound, no background music"
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/sora-2/text-to-video/pro",
    arguments={
        "prompt": "A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue. Cinematic lighting, warm sunset tones, shallow depth of field, gentle breeze moving autumn leaves, realistic natural sound, no background music"
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/sora-2/text-to-video/pro", {
  input: {
    prompt: "A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue. Cinematic lighting, warm sunset tones, shallow depth of field, gentle breeze moving autumn leaves, realistic natural sound, no background music"
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/sora-2/text-to-video/pro)
- [API Documentation](https://fal.ai/models/fal-ai/sora-2/text-to-video/pro/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/sora-2/text-to-video/pro)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)



# Sora 2 Pro · Image to Video

> Image-to-video endpoint for Sora 2 Pro, OpenAI's state-of-the-art video model capable of creating richly detailed, dynamic clips with audio from natural language or images.

> **Integration note (MaxVideoAi):** Fal webhooks must include the `token` query parameter when `FAL_WEBHOOK_TOKEN` is configured, otherwise callbacks are rejected and renders stay stuck in `running`.

## Overview

- **Endpoint**: `https://fal.run/fal-ai/sora-2/image-to-video/pro`
- **Model ID**: `fal-ai/sora-2/image-to-video/pro`
- **Category**: image-to-video
- **Kind**: inference
**Tags**: image-to-video, audio, sora-2-pro



## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`api_key`** (`string`, _optional_):
  The API key to use for the OpenAI API. If provided, you will not be billed for the request.

- **`prompt`** (`string`, _required_):
  The text prompt describing the video you want to generate
  - Examples: "Front-facing 'invisible' action-cam on a skydiver in freefall above bright clouds; camera locked on his face. He speaks over the wind with clear lipsync: 'This is insanely fun! You've got to try it—book a tandem and go!' Natural wind roar, voice close-mic'd and slightly compressed so it's intelligible. Midday sun, goggles and jumpsuit flutter, altimeter visible, parachute rig on shoulders. Energetic but stable framing with subtle shake; brief horizon roll. End on first tug of canopy and wind noise dropping."

- **`resolution`** (`ResolutionEnum`, _optional_):
  The resolution of the generated video Default value: `"auto"`
  - Default: `"auto"`
  - Options: `"auto"`, `"720p"`, `"1080p"`

- **`aspect_ratio`** (`AspectRatioEnum`, _optional_):
  The aspect ratio of the generated video Default value: `"auto"`
  - Default: `"auto"`
  - Options: `"auto"`, `"9:16"`, `"16:9"`

- **`duration`** (`DurationEnum`, _optional_):
  Duration of the generated video in seconds Default value: `"4"`
  - Default: `4`
  - Options: `4`, `8`, `12`

- **`image_url`** (`string`, _required_):
  The URL of the image to use as the first frame
  - Examples: "https://storage.googleapis.com/falserverless/example_inputs/sora-2-i2v-input.png"



**Required Parameters Example**:

```json
{
  "prompt": "Front-facing 'invisible' action-cam on a skydiver in freefall above bright clouds; camera locked on his face. He speaks over the wind with clear lipsync: 'This is insanely fun! You've got to try it—book a tandem and go!' Natural wind roar, voice close-mic'd and slightly compressed so it's intelligible. Midday sun, goggles and jumpsuit flutter, altimeter visible, parachute rig on shoulders. Energetic but stable framing with subtle shake; brief horizon roll. End on first tug of canopy and wind noise dropping.",
  "image_url": "https://storage.googleapis.com/falserverless/example_inputs/sora-2-i2v-input.png"
}
```

**Full Example**:

```json
{
  "prompt": "Front-facing 'invisible' action-cam on a skydiver in freefall above bright clouds; camera locked on his face. He speaks over the wind with clear lipsync: 'This is insanely fun! You've got to try it—book a tandem and go!' Natural wind roar, voice close-mic'd and slightly compressed so it's intelligible. Midday sun, goggles and jumpsuit flutter, altimeter visible, parachute rig on shoulders. Energetic but stable framing with subtle shake; brief horizon roll. End on first tug of canopy and wind noise dropping.",
  "resolution": "auto",
  "aspect_ratio": "auto",
  "duration": 4,
  "image_url": "https://storage.googleapis.com/falserverless/example_inputs/sora-2-i2v-input.png"
}
```


### Output Schema

The API returns the following output format:

- **`video`** (`VideoFile`, _required_):
  The generated video
  - Examples: {"content_type":"video/mp4","url":"https://storage.googleapis.com/falserverless/example_outputs/sora-2-pro-i2v-output.mp4"}

- **`video_id`** (`string`, _required_):
  The ID of the generated video
  - Examples: "video_123"



**Example Response**:

```json
{
  "video": {
    "content_type": "video/mp4",
    "url": "https://storage.googleapis.com/falserverless/example_outputs/sora-2-pro-i2v-output.mp4"
  },
  "video_id": "video_123"
}
```



### Pricing

| Parameter | Value |
|------------|--------|
| **Unit** | per second |
| **Price** | $0.30/s (720p) / $0.50/s (1080p) |
| **Notes** | Listed on fal.ai model page |
| **Source** | [Fal.ai – Sora 2 Pro Image to Video](https://fal.ai/models/fal-ai/sora-2/image-to-video/pro) |

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/sora-2/image-to-video/pro \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "Front-facing 'invisible' action-cam on a skydiver in freefall above bright clouds; camera locked on his face. He speaks over the wind with clear lipsync: 'This is insanely fun! You've got to try it—book a tandem and go!' Natural wind roar, voice close-mic'd and slightly compressed so it's intelligible. Midday sun, goggles and jumpsuit flutter, altimeter visible, parachute rig on shoulders. Energetic but stable framing with subtle shake; brief horizon roll. End on first tug of canopy and wind noise dropping.",
     "image_url": "https://storage.googleapis.com/falserverless/example_inputs/sora-2-i2v-input.png"
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/sora-2/image-to-video/pro",
    arguments={
        "prompt": "Front-facing 'invisible' action-cam on a skydiver in freefall above bright clouds; camera locked on his face. He speaks over the wind with clear lipsync: 'This is insanely fun! You've got to try it—book a tandem and go!' Natural wind roar, voice close-mic'd and slightly compressed so it's intelligible. Midday sun, goggles and jumpsuit flutter, altimeter visible, parachute rig on shoulders. Energetic but stable framing with subtle shake; brief horizon roll. End on first tug of canopy and wind noise dropping.",
        "image_url": "https://storage.googleapis.com/falserverless/example_inputs/sora-2-i2v-input.png"
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/sora-2/image-to-video/pro", {
  input: {
    prompt: "Front-facing 'invisible' action-cam on a skydiver in freefall above bright clouds; camera locked on his face. He speaks over the wind with clear lipsync: 'This is insanely fun! You've got to try it—book a tandem and go!' Natural wind roar, voice close-mic'd and slightly compressed so it's intelligible. Midday sun, goggles and jumpsuit flutter, altimeter visible, parachute rig on shoulders. Energetic but stable framing with subtle shake; brief horizon roll. End on first tug of canopy and wind noise dropping.",
    image_url: "https://storage.googleapis.com/falserverless/example_inputs/sora-2-i2v-input.png"
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/sora-2/image-to-video/pro)
- [API Documentation](https://fal.ai/models/fal-ai/sora-2/image-to-video/pro/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/sora-2/image-to-video/pro)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)



# MiniMax Hailuo 02 [Standard] (Text to Video)

> MiniMax Hailuo-02 Text To Video API (Standard, 768p): Advanced video generation model with 768p resolution


## Overview

- **Endpoint**: `https://fal.run/fal-ai/minimax/hailuo-02/standard/text-to-video`
- **Model ID**: `fal-ai/minimax/hailuo-02/standard/text-to-video`
- **Category**: text-to-video
- **Kind**: inference


## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`prompt`** (`string`, _required_)
  - Examples: "A Galactic Smuggler is a rogue figure with a cybernetic arm and a well-worn coat that hints at many dangerous escapades across the galaxy. Their ship is filled with rare and exotic treasures from distant planets, concealed in hidden compartments, showing their expertise in illicit trade. Their belt is adorned with energy-based weapons, ready to be drawn at any moment to protect themselves or escape from tight situations. This character thrives in the shadows of space, navigating between the law and chaos with stealth and wit, always seeking the next big score while evading bounty hunters and law enforcement. The rogue's ship, rugged yet efficient, serves as both a home and a tool for their dangerous lifestyle. The treasures they collect reflect the diverse and intriguing worlds they've encountered—alien artifacts, rare minerals, and artifacts of unknown origin. Their reputation precedes them, with whispers of their dealings and the deadly encounters that often follow. A master of negotiation and deception, the Galactic Smuggler navigates the cosmos with an eye on the horizon, always one step ahead of those who pursue them."

- **`duration`** (`DurationEnum`, _optional_):
  The duration of the video in seconds. 10 seconds videos are not supported for 1080p resolution. Default value: `"6"`
  - Default: `"6"`
  - Options: `"6"`, `"10"`

- **`prompt_optimizer`** (`boolean`, _optional_):
  Whether to use the model's prompt optimizer Default value: `true`
  - Default: `true`



**Required Parameters Example**:

```json
{
  "prompt": "A Galactic Smuggler is a rogue figure with a cybernetic arm and a well-worn coat that hints at many dangerous escapades across the galaxy. Their ship is filled with rare and exotic treasures from distant planets, concealed in hidden compartments, showing their expertise in illicit trade. Their belt is adorned with energy-based weapons, ready to be drawn at any moment to protect themselves or escape from tight situations. This character thrives in the shadows of space, navigating between the law and chaos with stealth and wit, always seeking the next big score while evading bounty hunters and law enforcement. The rogue's ship, rugged yet efficient, serves as both a home and a tool for their dangerous lifestyle. The treasures they collect reflect the diverse and intriguing worlds they've encountered—alien artifacts, rare minerals, and artifacts of unknown origin. Their reputation precedes them, with whispers of their dealings and the deadly encounters that often follow. A master of negotiation and deception, the Galactic Smuggler navigates the cosmos with an eye on the horizon, always one step ahead of those who pursue them."
}
```

**Full Example**:

```json
{
  "prompt": "A Galactic Smuggler is a rogue figure with a cybernetic arm and a well-worn coat that hints at many dangerous escapades across the galaxy. Their ship is filled with rare and exotic treasures from distant planets, concealed in hidden compartments, showing their expertise in illicit trade. Their belt is adorned with energy-based weapons, ready to be drawn at any moment to protect themselves or escape from tight situations. This character thrives in the shadows of space, navigating between the law and chaos with stealth and wit, always seeking the next big score while evading bounty hunters and law enforcement. The rogue's ship, rugged yet efficient, serves as both a home and a tool for their dangerous lifestyle. The treasures they collect reflect the diverse and intriguing worlds they've encountered—alien artifacts, rare minerals, and artifacts of unknown origin. Their reputation precedes them, with whispers of their dealings and the deadly encounters that often follow. A master of negotiation and deception, the Galactic Smuggler navigates the cosmos with an eye on the horizon, always one step ahead of those who pursue them.",
  "duration": "6",
  "prompt_optimizer": true
}
```


### Output Schema

The API returns the following output format:

- **`video`** (`File`, _required_):
  The generated video
  - Examples: {"url":"https://v3.fal.media/files/kangaroo/_qEOfY3iKHsc86kqHUUh2_output.mp4"}



**Example Response**:

```json
{
  "video": {
    "url": "https://v3.fal.media/files/kangaroo/_qEOfY3iKHsc86kqHUUh2_output.mp4"
  }
}
```



### Pricing

| Parameter | Value |
|------------|--------|
| **Unit** | per second |
| **Price** | $0.045/s |
| **Notes** | Listed on fal.ai model page |
| **Source** | [Fal.ai – MiniMax Hailuo‑02 Standard Text to Video](https://fal.ai/models/fal-ai/minimax/hailuo-02/standard/text-to-video) |

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/minimax/hailuo-02/standard/text-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "A Galactic Smuggler is a rogue figure with a cybernetic arm and a well-worn coat that hints at many dangerous escapades across the galaxy. Their ship is filled with rare and exotic treasures from distant planets, concealed in hidden compartments, showing their expertise in illicit trade. Their belt is adorned with energy-based weapons, ready to be drawn at any moment to protect themselves or escape from tight situations. This character thrives in the shadows of space, navigating between the law and chaos with stealth and wit, always seeking the next big score while evading bounty hunters and law enforcement. The rogue's ship, rugged yet efficient, serves as both a home and a tool for their dangerous lifestyle. The treasures they collect reflect the diverse and intriguing worlds they've encountered—alien artifacts, rare minerals, and artifacts of unknown origin. Their reputation precedes them, with whispers of their dealings and the deadly encounters that often follow. A master of negotiation and deception, the Galactic Smuggler navigates the cosmos with an eye on the horizon, always one step ahead of those who pursue them."
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/minimax/hailuo-02/standard/text-to-video",
    arguments={
        "prompt": "A Galactic Smuggler is a rogue figure with a cybernetic arm and a well-worn coat that hints at many dangerous escapades across the galaxy. Their ship is filled with rare and exotic treasures from distant planets, concealed in hidden compartments, showing their expertise in illicit trade. Their belt is adorned with energy-based weapons, ready to be drawn at any moment to protect themselves or escape from tight situations. This character thrives in the shadows of space, navigating between the law and chaos with stealth and wit, always seeking the next big score while evading bounty hunters and law enforcement. The rogue's ship, rugged yet efficient, serves as both a home and a tool for their dangerous lifestyle. The treasures they collect reflect the diverse and intriguing worlds they've encountered—alien artifacts, rare minerals, and artifacts of unknown origin. Their reputation precedes them, with whispers of their dealings and the deadly encounters that often follow. A master of negotiation and deception, the Galactic Smuggler navigates the cosmos with an eye on the horizon, always one step ahead of those who pursue them."
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/minimax/hailuo-02/standard/text-to-video", {
  input: {
    prompt: "A Galactic Smuggler is a rogue figure with a cybernetic arm and a well-worn coat that hints at many dangerous escapades across the galaxy. Their ship is filled with rare and exotic treasures from distant planets, concealed in hidden compartments, showing their expertise in illicit trade. Their belt is adorned with energy-based weapons, ready to be drawn at any moment to protect themselves or escape from tight situations. This character thrives in the shadows of space, navigating between the law and chaos with stealth and wit, always seeking the next big score while evading bounty hunters and law enforcement. The rogue's ship, rugged yet efficient, serves as both a home and a tool for their dangerous lifestyle. The treasures they collect reflect the diverse and intriguing worlds they've encountered—alien artifacts, rare minerals, and artifacts of unknown origin. Their reputation precedes them, with whispers of their dealings and the deadly encounters that often follow. A master of negotiation and deception, the Galactic Smuggler navigates the cosmos with an eye on the horizon, always one step ahead of those who pursue them."
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/minimax/hailuo-02/standard/text-to-video)
- [API Documentation](https://fal.ai/models/fal-ai/minimax/hailuo-02/standard/text-to-video/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/minimax/hailuo-02/standard/text-to-video)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)

# MiniMax Hailuo 02 [Standard] (Image to Video)

> MiniMax Hailuo-02 Image To Video API (Standard, 768p, 512p): Advanced image-to-video generation model with 768p and 512p resolutions


## Overview

- **Endpoint**: `https://fal.run/fal-ai/minimax/hailuo-02/standard/image-to-video`
- **Model ID**: `fal-ai/minimax/hailuo-02/standard/image-to-video`
- **Category**: image-to-video
- **Kind**: inference


## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`prompt`** (`string`, _required_)
  - Examples: "Man walked into winter cave with polar bear"

- **`image_url`** (`string`, _required_)
  - Examples: "https://storage.googleapis.com/falserverless/model_tests/minimax/1749891352437225630-389852416840474630_1749891352.png"

- **`duration`** (`DurationEnum`, _optional_):
  The duration of the video in seconds. 10 seconds videos are not supported for 1080p resolution. Default value: `"6"`
  - Default: `"6"`
  - Options: `"6"`, `"10"`

- **`prompt_optimizer`** (`boolean`, _optional_):
  Whether to use the model's prompt optimizer Default value: `true`
  - Default: `true`

- **`resolution`** (`ResolutionEnum`, _optional_):
  The resolution of the generated video. Default value: `"768P"`
  - Default: `"768P"`
  - Options: `"512P"`, `"768P"`

- **`end_image_url`** (`string`, _optional_):
  Optional URL of the image to use as the last frame of the video



**Required Parameters Example**:

```json
{
  "prompt": "Man walked into winter cave with polar bear",
  "image_url": "https://storage.googleapis.com/falserverless/model_tests/minimax/1749891352437225630-389852416840474630_1749891352.png"
}
```

**Full Example**:

```json
{
  "prompt": "Man walked into winter cave with polar bear",
  "image_url": "https://storage.googleapis.com/falserverless/model_tests/minimax/1749891352437225630-389852416840474630_1749891352.png",
  "duration": "6",
  "prompt_optimizer": true,
  "resolution": "768P"
}
```


### Output Schema

The API returns the following output format:

- **`video`** (`File`, _required_):
  The generated video
  - Examples: {"url":"https://v3.fal.media/files/monkey/xF9OsLwGjjNURyAxD8RM1_output.mp4"}



**Example Response**:

```json
{
  "video": {
    "url": "https://v3.fal.media/files/monkey/xF9OsLwGjjNURyAxD8RM1_output.mp4"
  }
}
```



### Pricing

| Parameter | Value |
|------------|--------|
| **Unit** | per second |
| **Price** | $0.045/s (768p) |
| **Notes** | Listed on fal.ai model page |
| **Source** | [Fal.ai – MiniMax Hailuo‑02 Standard Image to Video](https://fal.ai/models/fal-ai/minimax/hailuo-02/standard/image-to-video) |

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/minimax/hailuo-02/standard/image-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "Man walked into winter cave with polar bear",
     "image_url": "https://storage.googleapis.com/falserverless/model_tests/minimax/1749891352437225630-389852416840474630_1749891352.png"
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/minimax/hailuo-02/standard/image-to-video",
    arguments={
        "prompt": "Man walked into winter cave with polar bear",
        "image_url": "https://storage.googleapis.com/falserverless/model_tests/minimax/1749891352437225630-389852416840474630_1749891352.png"
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/minimax/hailuo-02/standard/image-to-video", {
  input: {
    prompt: "Man walked into winter cave with polar bear",
    image_url: "https://storage.googleapis.com/falserverless/model_tests/minimax/1749891352437225630-389852416840474630_1749891352.png"
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/minimax/hailuo-02/standard/image-to-video)
- [API Documentation](https://fal.ai/models/fal-ai/minimax/hailuo-02/standard/image-to-video/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/minimax/hailuo-02/standard/image-to-video)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)
