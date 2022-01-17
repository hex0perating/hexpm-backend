const express = require("express"),
      zipdir = require('zip-dir'),
      fs = require("fs"),
      app = express();

let packages = [];

app.get("/*.pkg", async function(req, res) {
    let pkg = req.originalUrl.replace('/', '').replace("%20", " ").replace(".pkg", "");

    for await (let p of packages) {
        if (p.name == pkg) {
            res.send(Buffer.from(p.buffer, 'binary'));
            return;
        }
    }
})

app.get("/packages.json", async function(req, res) {
    let newPkgs = [];

    for await (let pkg of packages) {
        newPkgs.push({
            name: pkg.name,
            version: pkg.version,
            url: `http://localhost:${process.env.PORT || 80}/${pkg.name}.pkg`
        })
    }

    res.send(newPkgs)
})

async function packagePkgs() {
    async function zip(path) {
        return new Promise((resolve, reject) => {
            zipdir(path, (err, buffer) => {
                if (err) throw(err);

                resolve(buffer);
            });
        })
    }
    let packageList = await fs.readdirSync("./src");
    console.log(`📦 Building packages...`);
    for await (let package of packageList) {
        console.log(`📦 Fetching package data`);
        let packagePath = `./src/${package}`;
        let packageJSON = JSON.parse(await fs.readFileSync(`${packagePath}/hexpkg.json`, "utf-8"));
        console.log(`📦 Building package ${packageJSON.name}`);
        
        let buffer = await zip(packagePath);

        packages.push({
            name: packageJSON.name,
            version: packageJSON.version,
            buffer: buffer
        })

        console.log(`📦 Package ${packageJSON.name} built`);
    }
    app.listen(process.env.PORT || 80, function() {
        function getPort() {//wtf?
            return process.env.PORT || 80;
        }
        console.log("✅ Listening on port " + getPort()); 
    })
}

packagePkgs();