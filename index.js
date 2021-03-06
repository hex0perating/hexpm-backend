const express = require("express"),
      zipdir = require('zip-dir'),
      fs = require("fs"),
      app = express();

let packages = [];

let reprovision = false;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

app.get("/*", async function(req, res) {
    while (reprovision) {
        await sleep(1000);
    }

    if (req.originalUrl == "/packages.json") {
        let newPkgs = [];

        for await (let pkg of packages) {
            let hexpkg = require(pkg.dir + "/hexpkg.json");
            newPkgs.push({
                name: pkg.name,
                version: pkg.version,
                description: hexpkg.description  
            })
        }

        res.send(newPkgs)
        return;
    } else if (req.originalUrl.replaceAll("%20", " ").startsWith("/zip/")) {
        console.log(`📦 Serving zip file ${req.originalUrl.replaceAll("%20", " ").split("/")[2]}`);
        let origUrl = req.originalUrl.replaceAll("%20", " ");

        let pkgName = origUrl.replaceAll("/zip/", "").replace(".zip", "");

        let pkg = packages.find(pkg => pkg.name == pkgName);

        res.send(Buffer.from(pkg.buffer, "binary"));
        return;
    }

    let pkg = req.originalUrl.replaceAll("%20", " ");
    let pkg_arr = pkg.split("/");
    let pkg_name = pkg_arr[1];
    let pkg_fetch = pkg_arr[2];

    for await(let item of packages) {
        if (pkg_name == item.name) {
            console.log(`📦 Fetching package file ${pkg_name}/${pkg_fetch}`);
            let pkg_path = `${item.dir}/${pkg_fetch}`;
            
            let file = "";

            try {
                file = await fs.readFileSync(pkg_path, "utf-8");
            } catch (e) {
                console.log(`📦 File ${pkg_name}/${pkg_fetch} not found`);
                res.status(404).send(`File ${pkg_fetch} not found`);
                return;
            }

            if (pkg_path.endsWith(".json")) {
                res.setHeader('Content-Type', 'application/json');
            } else if (pkg_path.endsWith(".js")) {
                res.setHeader('Content-Type', 'application/javascript');
            }

            res.send(file);

            return;
        }
    }
    
    res.status(404).send(`Package ${pkg_name} not found`);
})

async function packagePkgs() {
    async function zip(path) {
        return new Promise((resolve, reject) => {
            zipdir(path, function (err, buffer) {
                if (err) reject(err);
                resolve(buffer);
            });
        })
    }

    console.log("📦 Downloading packages...");

    try {
        await fs.rmSync("src", { recursive: true });
    } catch (e) {
        console.log("📦 Failed to delete src folder, possibly doesn't exist");
    }
    await fs.mkdirSync("src");

    let fetcher = "";

    if (process.env.LOCAL) {
        fetcher = require("./fetchLocalPkgs.js");// for hoster to configure
    } else {
        fetcher = require("./fetchPkgs.js");
    }

    await fetcher();

    console.log(`📦 Building packages...`);
    let packageList = await fs.readdirSync("./src");
    for await (let package of packageList) {
        console.log(`📦 Fetching package data`);
        let packagePath = `./src/${package}`;
        let packageJSON = JSON.parse(await fs.readFileSync(`${packagePath}/hexpkg.json`, "utf-8"));
        console.log(`📦 Building package ${packageJSON.name}`);

        packages.push({
            name: packageJSON.name,
            version: packageJSON.version,
            dir: packagePath,
            buffer: await zip(packagePath)
        })

        console.log(`📦 Package ${packageJSON.name} built`);
    }

    function getPort() {
        return process.env.PORT || 80;
    }

    app.listen(getPort(), function() {
        console.log("✅ Listening on port " + getPort()); 
    })
}

async function reprovisionTimer() {
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    while (true) {
        await sleep(120000); // 2 minutes
        reprovision = true;

        console.log("📦 Reprovisioning server...");
        
        await sleep(100); // waits for any remaining jobs to finish before clearing the buffer
        packages = [];

        async function zip(path) {
            return new Promise((resolve, reject) => {
                zipdir(path, function (err, buffer) {
                    if (err) reject(err);
                    resolve(buffer);
                });
            })
        }
    
        console.log("📦 Downloading packages...");
    
        try {
            await fs.rmSync("src", { recursive: true });
        } catch (e) {
            console.log("📦 Failed to delete src folder, possibly doesn't exist");
        }
        await fs.mkdirSync("src");
    
        let fetcher = "";
    
        if (process.env.LOCAL) {
            fetcher = require("./fetchLocalPkgs.js");// for hoster to configure
        } else {
            fetcher = require("./fetchPkgs.js");
        }
    
        await fetcher();
    
        console.log(`📦 Building packages...`);
        let packageList = await fs.readdirSync("./src");
        for await (let package of packageList) {
            console.log(`📦 Fetching package data`);
            let packagePath = `./src/${package}`;
            let packageJSON = JSON.parse(await fs.readFileSync(`${packagePath}/hexpkg.json`, "utf-8"));
            console.log(`📦 Building package ${packageJSON.name}`);
    
            packages.push({
                name: packageJSON.name,
                version: packageJSON.version,
                dir: packagePath,
                buffer: await zip(packagePath)
            })
    
            console.log(`📦 Package ${packageJSON.name} built`);
        }

        reprovision = false;
        console.log("📦 Reprovisioned server.");
    }
}

packagePkgs();
reprovisionTimer();