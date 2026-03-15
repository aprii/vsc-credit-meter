import * as vscode from 'vscode';
import { updateMeter } from './meter';

export function activate(context: vscode.ExtensionContext) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    
    const signInCommand = vscode.commands.registerCommand('copilotMeter.signIn', async () => {
        try {
            await vscode.authentication.getSession("github", ["user:email"], { createIfNone: true });
            updateMeter(statusBarItem, context);
        } catch (e) {
            vscode.window.showErrorMessage('Failed to sign in to GitHub for Copilot Meter.');
        }
    });
    context.subscriptions.push(signInCommand);
    
    // Initial update
    updateMeter(statusBarItem, context);

    // Update when configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('copilotMeter')) {
            updateMeter(statusBarItem, context);
        }
    }));

    // Poll every 5 minutes
    const intervalId = setInterval(() => {
        updateMeter(statusBarItem, context);
    }, 5 * 60 * 1000);

    context.subscriptions.push({ dispose: () => clearInterval(intervalId) });
}

export function deactivate() {}
