<img src="https://repository-images.githubusercontent.com/291634701/098af480-eb1a-11ea-847b-3d75a38d52c7" />

---

> A library used to connect to the discord gateway. <br />
> [NeoCord Support](https://discord.gg/5WD9KhF) &bull; [GitHub Repository](https://github.com/neo-cord/utils)

Requires **node.js v14.x.x** to work.

```shell script
yarn add @neocord/gateway
```

<h1 align="center">Basic Usage</h1>

```ts
import { InternalShardingManager, Intents } from "@neocord/gateway";

const manager = new InternalShardingManager({
  shards: "auto", // Creates the amount of recommended shards according to discord.
  compression: "zlib-sync", // see "1".
  useEtf: true, // enables etf encoding, requires the erlpack module
  intents: Intents.DEFAULTS, // Default Intents (defaults to it anyways lol)
  ...
});
```

**1**: Enables zlib compression.  
> *"zlib-sync"*: requires the [zlib-sync](https://npmjs.com/zlib-syc) package.  
> *"pako"*: requires the [pako](https://npmjs.com/pako) package.  
> *"zlib"*: uses the built-in zlib module node.js provides.

---

<p align="center">Licensed under the <strong>MIT License</strong></p>
