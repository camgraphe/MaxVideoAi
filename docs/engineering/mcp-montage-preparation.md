# MCP montage preparation

`prepare_montage` is a disabled-by-default, read-only MCP capability. It resolves 2–12 canonical `ma_` asset IDs against the connected OAuth owner and returns a contiguous edit plan over ready video media.

The plan uses integer frames at 24, 25, 30, or 60 fps. Each trim must fit within the source duration already measured in asset metadata, and the combined plan is limited to 180 seconds. Repeated assets are allowed and receive distinct derived clip IDs. Output includes only public asset IDs, safe labels, settings, frame ranges, totals, and an explicit `persisted: false` status.

This capability does not download or inspect media, infer semantic ordering, render, export, modify assets, or persist a Studio project. The caller supplies clip order. A future Studio adapter must re-resolve owned assets and implement its own transactional persistence contract.
