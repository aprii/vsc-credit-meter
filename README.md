# Token Meter for GitHub Copilot

This is a VS Code extension that adds a tracking progress bar for your GitHub Copilot daily allowable token units. It works by looking at your current subscription cycle and comparing your *used* Premium tokens against the *allowed* Premium tokens up to the current day.

## How it works

1. Computes the current subscription bounds based on the setting `copilotMeter.subscriptionStartDay`.
2. Determines the number of total working days (Mon-Fri) in the current month.
3. Retrieves the undocumented telemetry directly from GitHub using your signed-in VS Code GitHub account.
4. Generates a progress bar based on exactly how many tokens you've used versus how many you are "allowed" to have used by today.

## Installation / Development

Since this extension contains TypeScript source code, it requires Node.js to compile. 

1. Ensure you have Node.js and `npm` installed.
2. Open this directory in VS Code.
3. Run `npm install` in the terminal to install the dependencies.
4. Run `npm run compile` to build the required JavaScript bundle.
5. Press `F5` in VS Code to launch an Extension Development Host window with this extension loaded!

Alternatively, to package it locally, use `npx vsce package`.

## Features
- Dynamic text progress bar `[████░░░░] 45%`
- Rich tooltip with absolute limits and math breakdown.
- Red warning background when you exceed the internal daily token goal.
