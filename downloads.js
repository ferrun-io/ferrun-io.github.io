// Copyright (c) 2026 Ferrun contributors. All rights reserved.
//
// Responsibility: Render downloads and installation commands from public files.
// Connections: The release publisher indexes downloads/; the static download,
// installation and SDK pages load that index through this script.

function element(tag, text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

function link(text, url) {
  const node = element('a', text);
  node.href = url;
  return node;
}

function platform(name) {
  const system = /linux/.test(name)
    ? 'Linux'
    : /apple|macosx/.test(name)
      ? 'macOS'
      : /windows|win_/.test(name)
        ? 'Windows'
        : '';
  const arch = /aarch64|arm64/.test(name)
    ? 'ARM64'
    : /x86_64|amd64/.test(name)
      ? 'x64'
      : '';
  return system && arch ? `${system} · ${arch}` : name;
}

function sdk(name) {
  return /\.(whl|tgz)$/.test(name);
}

function bundle(name) {
  return /\.(tar\.gz|zip)$/.test(name);
}

function command(name, url) {
  if (!bundle(name)) {
    return name.endsWith('.exe')
      ? `Invoke-WebRequest '${url}' -OutFile ferrun.exe; if ($?) { .\\ferrun.exe setup }`
      : `curl --fail --location '${url}' --output ferrun && chmod +x ferrun && ./ferrun setup`;
  }
  if (name.endsWith('.zip')) {
    return `$archive = '${name}'
$expected = ((Get-Content "$archive.sha256" -Raw).Trim() -split '\\s+')[0]
if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne $expected) {
    throw 'Archive checksum does not match'
}
$destination = [IO.Path]::GetFileNameWithoutExtension($archive)
if (Test-Path $destination) { throw 'Choose an empty destination' }
Expand-Archive $archive -DestinationPath $destination`;
  }
  const checksum = name.includes('apple') ? 'shasum -a 256' : 'sha256sum';
  return `(
  set -eu
  archive='${name}'
  ${checksum} -c "$archive.sha256"
  destination="\${archive%.tar.gz}"
  mkdir "$destination"
  tar -xzf "$archive" -C "$destination"
)`;
}

function render(root, inventory) {
  const content = document.createDocumentFragment();
  const kind = root.dataset.downloads;
  const versions = Object.keys(inventory).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true }),
  );
  for (const version of versions) {
    const files = inventory[version];
    if (
      !/^v\d+\.\d+\.\d+$/.test(version) ||
      !files ||
      Object.keys(files).some((name) => !/^[A-Za-z0-9_.-]+$/.test(name))
    ) {
      throw new Error('Invalid download index');
    }
    let names = Object.keys(files).filter((name) =>
      kind === 'sdk' ? sdk(name) : name.startsWith(`ferrun-${version}-`),
    );
    names = names.filter((name) => !name.endsWith('.sha256'));
    if (kind !== 'sdk') {
      // Prefer the standalone CLI when that release also contains its bundle.
      names = names.filter(
        (name) =>
          !bundle(name) ||
          !(name.replace(/\.tar\.gz$/, '').replace(/\.zip$/, '.exe') in files),
      );
    }
    if (!names.length) continue;
    const section = element('details');
    section.open = !content.childNodes.length;
    section.append(element('summary', version));
    const list = element('ul');
    for (const name of names.sort()) {
      const url = new URL(`downloads/${version}/${name}`, document.baseURI).href;
      const type = sdk(name)
        ? name.endsWith('.whl')
          ? 'Python'
          : 'JavaScript / TypeScript'
        : bundle(name)
          ? 'Bundle'
          : 'CLI';
      const row = element('li');
      row.append(link(`${platform(name)} · ${type}`, url));
      if (name + '.sha256' in files) {
        row.append(' · ', link('Checksum', url + '.sha256'));
      }
      if (kind === 'install') {
        if (bundle(name)) {
          row.append(element('p', 'Download the bundle and checksum, then run:'));
        }
        const pre = element('pre');
        pre.append(element('code', command(name, url)));
        row.append(pre);
      } else {
        row.append(` (${(files[name] / 1_000_000).toFixed(1)} MB)`);
      }
      list.append(row);
    }
    section.append(list);
    if ('release-notes.txt' in files) {
      section.append(link('Release notes', `downloads/${version}/release-notes.txt`));
    }
    content.append(section);
  }
  root.replaceChildren(
    content.childNodes.length
      ? content
      : element('p', 'No releases are available for download.'),
  );
}

async function loadDownloads() {
  const roots = [...document.querySelectorAll('[data-downloads]')];
  try {
    const response = await fetch('downloads/index.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Download index unavailable');
    const inventory = await response.json();
    for (const root of roots) render(root, inventory);
  } catch {
    for (const root of roots) {
      root.replaceChildren(
        element('p', 'Downloads could not be loaded. Reload this page to try again.'),
      );
    }
  }
}

loadDownloads();
