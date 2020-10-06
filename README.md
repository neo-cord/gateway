<img src="https://repository-images.githubusercontent.com/291619880/8b583d80-eb6d-11ea-8300-3206ef4d5136" />

---

> A library used to connect to the discord gateway. <br />
> [NeoCord Support](https://discord.gg/5WD9KhF) &bull; [GitHub Repository](https://github.com/neo-cord/gateway)

Requires **node.js v14.x.x** to work.

```shell script
yarn add @neocord/gateway
```

<h2 align="center">Basic Usage</h2>

```ts
import { ShardManager, Intents } from "@neocord/gateway";

const manager = new ShardManager({
  shards: "auto", // Creates the amount of recommended shards according to discord.
  compression: "zlib-sync", // see "1".
  useEtf: true, // enables erlpack encoding, requires the "etf.js" module
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
