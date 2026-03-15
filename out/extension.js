"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const meter_1 = require("./meter");
function activate(context) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    const signInCommand = vscode.commands.registerCommand('copilotMeter.signIn', async () => {
        try {
            await vscode.authentication.getSession("github", ["user:email"], { createIfNone: true });
            (0, meter_1.updateMeter)(statusBarItem, context);
        }
        catch (e) {
            vscode.window.showErrorMessage('Failed to sign in to GitHub for Copilot Meter.');
        }
    });
    context.subscriptions.push(signInCommand);
    // Initial update
    (0, meter_1.updateMeter)(statusBarItem, context);
    // Update when configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('copilotMeter')) {
            (0, meter_1.updateMeter)(statusBarItem, context);
        }
    }));
    // Poll every 5 minutes
    const intervalId = setInterval(() => {
        (0, meter_1.updateMeter)(statusBarItem, context);
    }, 5 * 60 * 1000);
    context.subscriptions.push({ dispose: () => clearInterval(intervalId) });
}
function deactivate() { }
//# sourceMappingURL=extension.js.map