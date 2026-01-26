import { beforeEach, describe, expect, it } from "bun:test";
import { cleanup, redis } from "../setup";

beforeEach(cleanup);

const basicCode = `
  #!lua name=mylib
  redis.register_function('helloworld',
    function()
      return 'Hello World!'
    end
  )`;

const advancedCode = `
#!lua name=advlib
redis.register_function('my_hset',
  function(keys, args)
    local hash = keys[1]
    local time = redis.call('TIME')[1]
    return redis.call('HSET', hash, '_last_modified_', time, unpack(args))
  end
)
redis.register_function({
  function_name='get_value',
  callback=function(keys, args)
    return redis.call('GET', keys[1])
  end,
  flags={ 'no-writes' }
})
`;

describe("Functions", () => {
    describe("load", () => {
        it("should load a basic function", async () => {
            const name = await redis.functions.load({
                code: basicCode,
                replace: true,
            });
            expect(name).toBe("mylib");
        });

        it("should load multiple functions from one library", async () => {
            const name = await redis.functions.load({
                code: advancedCode,
                replace: true,
            });
            expect(name).toBe("advlib");
        });

        it("should replace existing library with replace flag", async () => {
            await redis.functions.load({ code: basicCode, replace: true });
            const name = await redis.functions.load({
                code: basicCode,
                replace: true,
            });
            expect(name).toBe("mylib");
        });
    });

    describe("call", () => {
        beforeEach(async () => {
            await redis.functions.load({ code: basicCode, replace: true });
        });

        it("should call a basic function", async () => {
            const res = await redis.functions.call("helloworld");
            expect(res).toBe("Hello World!");
        });

        it("should call function with keys and args", async () => {
            await redis.functions.load({ code: advancedCode, replace: true });
            const res = await redis.functions.call(
                "my_hset",
                ["myhash"],
                ["field1", "value1", "field2", "value2"],
            );
            expect(typeof res).toBe("number");
        });
    });

    describe("callRo", () => {
        beforeEach(async () => {
            await redis.functions.load({ code: advancedCode, replace: true });
            await redis.set("mykey", "myvalue");
        });

        it("should call read-only function", async () => {
            const res = await redis.functions.callRo("get_value", ["mykey"]);
            expect(res).toBe("myvalue");
        });
    });

    describe("list", () => {
        beforeEach(async () => {
            await redis.functions.load({ code: basicCode, replace: true });
            await redis.functions.load({ code: advancedCode, replace: true });
        });

        it("should list all libraries", async () => {
            const libs = await redis.functions.list();
            expect(Array.isArray(libs)).toBe(true);
            expect(libs.length).toBe(2);
        });

        it("should list specific library by name pattern", async () => {
            const libs = await redis.functions.list({
                libraryName: "mylib",
            });
            expect(libs.length).toBe(1);
            expect(libs[0]?.libraryName).toBe("mylib");
        });

        it("should include library code when requested", async () => {
            const libs = await redis.functions.list({
                libraryName: "mylib",
                withCode: true,
            });
            expect(libs[0]?.libraryCode).toBeDefined();
            expect(libs[0]?.libraryCode).toContain("#!lua");
        });

        it("should list function details", async () => {
            const libs = await redis.functions.list({
                libraryName: "advlib",
            });
            const funcs = libs[0]?.functions;
            expect(Array.isArray(funcs)).toBe(true);
            expect(funcs?.length).toBe(2);
            expect(funcs?.some((f) => f.name === "my_hset")).toBe(true);
            expect(funcs?.some((f) => f.name === "get_value")).toBe(true);
        });

        it("should include flags in function details", async () => {
            const libs = await redis.functions.list({
                libraryName: "advlib",
            });
            const getValueFunc = libs[0]?.functions?.find(
                (f) => f.name === "get_value",
            );
            expect(getValueFunc?.flags).toContain("no-writes");
        });
    });

    describe("stats", () => {
        beforeEach(async () => {
            await redis.functions.load({ code: basicCode, replace: true });
            await redis.functions.load({ code: advancedCode, replace: true });
        });

        it("should return function stats", async () => {
            const stats = await redis.functions.stats();
            expect(stats.engines).toBeDefined();
            expect(stats.engines.LUA).toBeDefined();
        });

        it("should count libraries correctly", async () => {
            const stats = await redis.functions.stats();
            expect(stats?.engines?.LUA?.librariesCount).toBe(2);
        });

        it("should count functions correctly", async () => {
            const stats = await redis.functions.stats();
            expect(stats?.engines?.LUA?.functionsCount).toBe(3);
        });
    });

    describe("delete", () => {
        beforeEach(async () => {
            await redis.functions.load({ code: basicCode, replace: true });
            await redis.functions.load({ code: advancedCode, replace: true });
        });

        it("should delete a library", async () => {
            const res = await redis.functions.delete("mylib");
            expect(res).toBe("OK");
        });

        it("should remove library from list after deletion", async () => {
            await redis.functions.delete("mylib");
            const libs = await redis.functions.list();
            await new Promise(resolve => setTimeout(resolve, 10));
            expect(libs.some((l) => l.libraryName === "mylib")).toBe(false);
        });

        it("should update stats after deletion", async () => {
            await redis.functions.delete("mylib");
            const stats = await redis.functions.stats();
            expect(stats?.engines?.LUA?.librariesCount).toBe(1);
            expect(stats?.engines?.LUA?.functionsCount).toBe(2);
        });
    });

    describe("flush", () => {
        beforeEach(async () => {
            await redis.functions.load({ code: basicCode, replace: true });
            await redis.functions.load({ code: advancedCode, replace: true });
        });

        it("should flush all functions", async () => {
            const res = await redis.functions.flush();
            expect(res).toBe("OK");
        });

        it("should remove all libraries after flush", async () => {
            await redis.functions.flush();
            const libs = await redis.functions.list();
            expect(libs.length).toBe(0);
        });

        it("should reset stats after flush", async () => {
            await redis.functions.flush();
            const stats = await redis.functions.stats();
            expect(stats.engines?.LUA?.librariesCount).toBe(0);
            expect(stats.engines?.LUA?.functionsCount).toBe(0);
        });
    });
});