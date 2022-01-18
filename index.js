const express = require("express"),
      zipdir = require('zip-dir'),
      fs = require("fs"),
      app = express();

let packages = [];

app.get("/*", async function(req, res) {
    let pkg = req.originalUrl.replace("%20", " ");
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
    let packageList = await fs.readdirSync("./src");
    console.log(`📦 Building packages...`);
    for await (let package of packageList) {
        console.log(`📦 Fetching package data`);
        let packagePath = `./src/${package}`;
        let packageJSON = JSON.parse(await fs.readFileSync(`${packagePath}/hexpkg.json`, "utf-8"));
        console.log(`📦 Building package ${packageJSON.name}`);

        packages.push({
            name: packageJSON.name,
            version: packageJSON.version,
            dir: packagePath,
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

packagePkgs();