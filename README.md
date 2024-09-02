# timerecorder

Simple tool to keep track of asynchronous events and their duration.


<!-- vim-markdown-toc GitLab -->

* [Installation](#installation)
* [Usage](#usage)
* [API](#api)
    * [(async) record(label, promise, callback)](#async-recordlabel-promise-callback)
        * [Callback](#callback)
    * [(async) sleep(ms, msg, callback)](#async-sleepms-msg-callback)
    * [flush()](#flush)
    * [play(reportLogFn, reportDataFn)](#playreportlogfn-reportdatafn)
* [Example](#example)
    * [Sample code](#sample-code)
    * [Sample outputs](#sample-outputs)
        * [Notes](#notes)

<!-- vim-markdown-toc -->


## Installation

```sh
npm install timerecorder
```

## Usage

To use timerecorder in your code, start by adding the following lines:

```javascript
const timerecorder = require("timerecorder");
const tr = new timerecorder();
```

> 📌 Reported timestamps start from when you instantiate the timerecorder
> class. For accurate timing, place the instantiation at the appropriate
> location in your code.


## API

### (async) record(label, promise, callback)

Records the start and end times of a promise, labeling the record for easy
identification.

**Arguments:**

  * **label:** Text to easily identify the record.
  * **promise:** The promise to monitor.
  * **callback:** (Optional) A callback to do something at promise resolution
    or rejection.

Returns the same promise so that it can wrap around any promise with minimal
impact on the observed code, even if the promise ends up being rejected.

Afterwards [play() method](#playreportlog-consolelog-reportdata-consoletable)
can be called to retrieve a report of all recorded events.


#### Callback

If provided, the callback is executed after the promise resolves or is
rejected.

```javascript
function cbk(err, retValue) {
    // err: error object if the promise is rejected, otherwise null
    // retValue: value returned by the resolved promise
    /*
     * (Collect some data...)
     */
    return data;
}
```

Data returned by callback will be attached to the report.


### (async) sleep(ms, msg, callback)

Handy sleep method that generates a promise to sleep given milliseconds and
record it.

**Arguments:**

  * **ms:** The number of milliseconds to wait.
  * **msg:** (Optional) Message to be shown (default "Sleeping <time>).
  * **callback:** (Optional callback (passed through to `record()` method).

Useful to perform some tasks or check values after given delay (See [sample
code](#sample-code) below).


### flush()

Flush already collected data just in case you want to start over on some event.


### play(reportLogFn, reportDataFn)

Outputs an easy-to-understand report of all collected events.

**Arguments:**

  * **reportLogFn:** (Optional) Log function for text reports (defaults to
    console.log).

  * **reportDataFn:** (Optional) Log function for data returned by callbacks.

See [sample outputs](#sample-outputs) below.


## Example

Following code shows what happen when
[node-postgres](https://github.com/brianc/node-postgres)' `pool.end()` is
called while a long-run query is ongoing.

> 📌 *node-postgres* (or *pg*) is the official Node.js module for connecting to
> the [PostgreSQL](https://www.postgresql.org/)
> [RDBMS](https://en.wikipedia.org/wiki/Relational_database) which provides a
> [pooling](https://en.wikipedia.org/wiki/Connection_pool) interface for
> connection sharing.
>
> This example aims to highlight the underlying reasons for the observed delays
> when a *pool* is released.
> 
> This is also, in the context of the development of a [high-availability
> oriented wrapper](https://github.com/bitifet/node-postgres-ha) over
> *node-postgres*, the underlying reason that motivated the implementation of
> *timerecorder*.

Look at [sample outputs](#sample-outputs) to see the difference with the
*sleep* section commented in and out...


### Sample code

```javascript
const timerecorder = require("timerecorder");
const {poolStatus} = require("./some_helper_file.js");

const tr = new timerecorder();

(async ()=>{
    const { Pool } = require("pg");

    // Create the pool:
    tr.record("Pool creation"); // Just to mark this moment
    const pool = new Pool();    // ...since Pool constructor is synchronous.

    // Request for a long-lasting query (wihout awaiting):
    tr.record(
        "Async query"
        , pool.query('SELECT NOW() from pg_sleep(2)')
        , ()=>poolStatus(pool)
    );

    // // Give room for the query to finish:
    // // (Comment in to compare results)
    // await tr.sleep(
    //     2000
    //     , "Wait 2 seconds"
    //     , ()=>pool.status()
    // );

    // Shut down the pool:
    await tr.record(
        "Pool ending"
        , pool.end()
        , ()=>poolStatus(pool)
    );

    // Show collected reports:
    tr.play();

})()
```


### Sample outputs

Following, the output of previous code before and after commenting the
*tr.sleep* part in.

See below [notes](#notes) afterwards to better appreciate the details.

```
 Without sleep                                   │ With sleep
 -------------                                   │ ----------
                                                 │
 📝 00:00:00.028 ⏳ ??:??:??.??? - Pool creation │ 📝 00:00:00.034 ⏳ ??:??:??.??? - Pool creation
 ✔️  00:00:00.039 ⏳ ??:??:??.??? - Async query   │ ✔️  00:00:00.047 ⏳ ??:??:??.??? - Async query
 ✔️  00:00:00.039 ⏳ ??:??:??.??? - Pool ending   │ ✔️  00:00:00.048 ⏳ ??:??:??.??? - Wait 2 seconds
 ✅ 00:00:02.063 ⏱️ 00:00:02.024 - Async query   │ ✅ 00:00:02.049 ⏱️ 00:00:02.001 - Wait 2 seconds
 ┌──────────┬────────┐                           │ ┌──────────┬────────┐
 │ (index)  │ Values │                           │ │ (index)  │ Values │
 ├──────────┼────────┤                           │ ├──────────┼────────┤
 │   max    │   10   │                           │ │   max    │   10   │
 │   used   │   0    │                           │ │   used   │   1    │
 │   free   │   10   │                           │ │   free   │   9    │
 │   idle   │   0    │                           │ │   idle   │   0    │
 │  alive   │   0    │                           │ │  alive   │   1    │
 │ timedOut │   0    │                           │ │ timedOut │   0    │
 │ defunct  │   0    │                           │ │ defunct  │   0    │
 │ pending  │   0    │                           │ │ pending  │   0    │
 │ connErr  │ false  │                           │ │ connErr  │ false  │
 └──────────┴────────┘                           │ └──────────┴────────┘
 ✅ 00:00:02.063 ⏱️ 00:00:02.024 - Pool ending   │ ✔️  00:00:02.049 ⏳ ??:??:??.??? - Pool ending
 ┌──────────┬────────┐                           │ ✅ 00:00:02.073 ⏱️ 00:00:02.026 - Async query
 │ (index)  │ Values │                           │ ┌──────────┬────────┐
 ├──────────┼────────┤                           │ │ (index)  │ Values │
 │   max    │   10   │                           │ ├──────────┼────────┤
 │   used   │   0    │                           │ │   max    │   10   │
 │   free   │   10   │                           │ │   used   │   0    │
 │   idle   │   0    │                           │ │   free   │   10   │
 │  alive   │   0    │                           │ │   idle   │   0    │
 │ timedOut │   0    │                           │ │  alive   │   0    │
 │ defunct  │   0    │                           │ │ timedOut │   0    │
 │ pending  │   0    │                           │ │ defunct  │   0    │
 │ connErr  │ false  │                           │ │ pending  │   0    │
 └──────────┴────────┘                           │ │ connErr  │ false  │
                                                 │ └──────────┴────────┘
                                                 │ ✅ 00:00:02.073 ⏱️ 00:00:00.024 - Pool ending
                                                 │ ┌──────────┬────────┐
                                                 │ │ (index)  │ Values │
                                                 │ ├──────────┼────────┤
                                                 │ │   max    │   10   │
                                                 │ │   used   │   0    │
                                                 │ │   free   │   10   │
                                                 │ │   idle   │   0    │
                                                 │ │  alive   │   0    │
                                                 │ │ timedOut │   0    │
                                                 │ │ defunct  │   0    │
                                                 │ │ pending  │   0    │
                                                 │ │ connErr  │ false  │
                                                 │ └──────────┴────────┘
```

#### Notes


  * Without the sleep, `pool.end()` takes 2.024 seconds to resolve because it
    has to await for running queries to finish.

  * With the sleep added, pool.end() takes only an additional 24ms, as the
    query had already completed.

  * Thanks to the *poolStatus()* helper (not provided since it is out of the
    scope of this example) we can see a few status characteristics of the pool
    after several promise resolutions (those where we called it in the
    callback).

  * Then, it is also easy to notice that, after the 2 seconds delay, the client
    used for the query is still connected (used) in the pool (and needs to be
    gracefully disconnected). Hence the remaining delay at `pool.end()`
    resolution.


