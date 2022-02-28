#!/usr/bin/env node

const path = require("path");
const loading = require("loading-cli");
const slugify = require("slugify").default;
const prompts = require("prompts");
const makeDir = require("make-dir");
const Commander = require("commander");
const chalk = require("chalk").default;
const promisePipe = require("promisepipe");
const got = require("got");
const replace = require("replace");
const { extract } = require("tar");
const packageJson = require("./package.json");

let projectPath = "";

const program = new Commander.Command(packageJson.name)
  .version(packageJson.version)
  .arguments("[directory]")
  .usage(`${chalk.green("[project-directory]")}`)
  .action(directory => {
    projectPath = directory;
  })
  .parse(process.argv);

async function run(directory) {
  if (!directory || typeof directory != "string") {
    console.log();
    console.log(
      `${chalk.blue(
        "project directory not specified, using slug as directory name."
      )}`
    );
    console.log();
  } else {
    console.log();
    console.log(
      `${chalk.blue("Attempting to install theme at")} ${chalk.bold(
        path.resolve(directory)
      )}`
    );
    console.log();
  }

  const questions = [
    {
      type: "text",
      name: "name",
      message: "Theme name",
      initial: "My Awesome Theme"
    },
    {
      type: "text",
      name: "slug",
      message: "Theme slug",
      initial: "my-awesome-theme",
      validate: slug => {
        const isValid = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(slug);

        return isValid
          ? true
          : `Invalid slug. Use: ${chalk.bold(slugify(slug.toLowerCase()))}`;
      }
    },
    {
      type: "text",
      name: "author",
      message: "Author name",
      initial: "Juan Olvera"
    },
    {
      type: "text",
      name: "url",
      message: "Author URI",
      initial: "https://github.com/j0lv3r4",
      validate: url => {
        const isValid = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(
          url
        );

        return isValid ? true : "Invalid URL.";
      }
    },
    { type: "text", name: "description", message: "Description" }
  ];

  const load = loading(`${chalk.blue("Downloading and extracting files.")}`);
  load.frame(["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"]);

  try {
    const { name, slug, author, url, description } = await prompts(questions);

    const root = path.resolve(directory ? directory.trim() : slug.trim());

    await makeDir(root);
    process.chdir(root);

    console.log();

    load.start();

    await downloadAndExtract(root);

    replace({
      regex: "Theme Name: Empty",
      replacement: `Theme Name: ${name}`,
      paths: ["./src/scss/defaults/wordpress.scss", "./style.css"],
      silent: true
    });

    replace({
      regex: "Author: Juan Olvera",
      replacement: `Author: ${author}`,
      paths: ["./src/scss/defaults/wordpress.scss", "./style.css"],
      silent: true
    });

    replace({
      regex: "Author URI: https://github.com/j0lv3r4",
      replacement: `Author URI: ${url}`,
      paths: ["./src/scss/defaults/wordpress.scss", "./style.css"],
      silent: true
    });

    replace({
      regex: "Description: Starter theme based on _s",
      replacement: `Description ${description}`,
      paths: ["./src/scss/defaults/wordpress.scss", "./style.css"],
      silent: true
    });

    // Search for: Text Domain: _s and replace with: Text Domain: megatherium-is-awesome in style.css.
    replace({
      regex: "Text Domain: Empty",
      replacement: `Text Domain: ${slug}`,
      paths: ["./src/scss/defaults/wordpress.scss", "./style.css"],
      silent: true
    });

    // Search for: _s_ and replace with: megatherium_is_awesome_.
    replace({
      regex: "Empty_",
      replacement: `${slugify(slug, "_")}_`,
      paths: [root],
      recursive: true,
      include: "*.php",
      silent: true
    });

    // Search for:  _s and replace with:  Megatherium_is_Awesome.
    replace({
      regex: " Empty",
      replacement: ` ${slugify(name, "_")}`,
      paths: [root],
      recursive: true,
      include: "*.php",
      silent: true
    });

    // Search for: _s- and replace with: megatherium-is-awesome-.
    replace({
      regex: "Empty-",
      replacement: `${slug}-`,
      paths: [root],
      recursive: true,
      include: "*.php",
      silent: true
    });

    // Search for: '_s' and replace with: 'megatherium-is-awesome'.
    replace({
      regex: "'Empty'",
      replacement: `'${slug}'`,
      paths: [root],
      recursive: true,
      include: "*.php",
      silent: true
    });

    load.stop();

    load.succeed(
      `${chalk.green("Success!")} Created ${chalk.blue.bold(
        name
      )} at ${chalk.blue.bold(root)}`
    );
    console.log();
  } catch (err) {
    load.fail("Unexpected error. See below.");
    console.error(err);
  }
}

/**
 * @param {string} root
 * @returns {promise}
 */
async function downloadAndExtract(root) {
  return await promisePipe(
    got.stream(
      "https://codeload.github.com/j0lv3r4/empty/tar.gz/master"
    ),
    extract({ cwd: root, strip: 1 })
  );
}

run(projectPath);
