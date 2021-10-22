# Datasled transform module


## Example

For each message, parse the body as JSON and append the field `name` to the key of the message.

``` typescript

import {
  each, to_byte_array, to_json, to_string
} from "https://raw.githubusercontent.com/84codes/datasled-transformer/main/mod.ts";

await each(msg => {
  let body = to_json(msg.body);
  msg.key = to_byte_array(to_string(msg.key) + "." + body.name);
  msg.headers.set("transformed", "1")
  return msg;
});

```
