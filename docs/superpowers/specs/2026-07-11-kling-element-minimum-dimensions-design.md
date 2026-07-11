# Kling Element Minimum Image Dimensions

## Context

Kling 3 rejected job `job_0e553407-e79e-4eef-9ed1-694895a384c8` with HTTP 422 because an element reference image measured 648 x 157 pixels. The start frame measured 1484 x 1060 pixels and was valid. Kling requires every source image used by an element to be at least 300 pixels wide and at least 300 pixels high.

The provider rejection currently happens after the wallet charge is reserved. The charge is refunded correctly, but the receipt records the generic reason `Unexpected status code: 422`, which does not tell the customer how to correct the input.

## Intended behavior

Before billing or provider submission, the generate route validates the known dimensions of every frontal and reference image supplied in a Kling element.

An image is valid only when both conditions are true:

- width is at least 300 pixels;
- height is at least 300 pixels.

For a known undersized image, generation stops before a wallet charge is reserved or a job is submitted. The API returns HTTP 422 with a stable error code and a customer-facing message that includes the actual and required dimensions:

> This image is 648 x 157 px. Kling requires at least 300 px in width and 300 px in height. Choose a larger image and try again.

The message must not use the ambiguous shorthand `minimum dimensions are 300x300` on its own.

## Scope

The validation applies to source images inside Kling elements: frontal images and reference images. It does not change the behavior of unrelated engines or ordinary image inputs.

The server resolves dimensions from user-owned asset records using the authenticated user and the supplied asset identifiers or URLs. If dimensions are unavailable, the request remains eligible for provider submission so that legacy or externally stored valid assets are not blocked. The existing provider error translation remains the final safety net.

## Architecture

A route-local asynchronous validator owns the Kling element dimension check. The generate route invokes it after request and attachment normalization, but before billing preflight and atomic job creation.

The validator:

1. exits immediately for requests without Kling elements;
2. collects frontal and reference asset identifiers and URLs;
3. reads matching user asset dimensions in one database query;
4. finds the first known image whose width or height is below 300 pixels;
5. returns a structured HTTP 422 response containing the stable error code, field context, actual dimensions, required dimensions, and clear customer message.

Dependencies are injectable so focused tests can exercise the real validation logic without a database connection.

## Error contract

The rejected response uses:

- status: `422`;
- error: `KLING_ELEMENT_IMAGE_TOO_SMALL`;
- message: explicit actual width and height plus explicit minimum width and height;
- actualWidth and actualHeight;
- minimumWidth and minimumHeight, both set to `300`.

No provider message, raw URL, storage key, or internal database detail is exposed to the customer.

## Tests

Focused tests cover:

- 648 x 157 is rejected because height is below 300;
- 299 x 600 is rejected because width is below 300;
- 300 x 300 is accepted;
- valid start-frame behavior is unchanged;
- unknown dimensions do not cause a false rejection;
- validation occurs before the billing preflight call in the generate route contract.

The implementation follows red-green-refactor: add the failing focused tests, confirm they fail for the missing behavior, then add the smallest production change that makes them pass.
