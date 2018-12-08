# speedcontrol-esacontroller

Expansion bundle that works alongside [nodecg-speedcontrol](https://github.com/speedcontrol/nodecg-speedcontrol). Written for the European Speedrunner Assembly events, this is a undocumented API that can be used to send data to an external server when runs are completed, and receive commands to control the timer (for our "big red buttons"). Please don't rely on it, it will be gone in the (near) future, just here so it's not in the main bundle anymore and for legacy use.

### Config

```
"api": {
	"enable": true,
	"sharedKey": "TWITCH_ID",
	"hooks": ["HOOK_URL"]
}
```
