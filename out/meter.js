"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUsageData = fetchUsageData;
exports.getSubscriptionMonthBounds = getSubscriptionMonthBounds;
exports.getElapsedWorkingDays = getElapsedWorkingDays;
exports.getTotalWorkingDaysInBounds = getTotalWorkingDaysInBounds;
exports.generateProgressBar = generateProgressBar;
exports.updateMeter = updateMeter;
const vscode = require("vscode");
async function fetchUsageData(context) {
    try {
        const session = await vscode.authentication.getSession("github", ["user:email"], { createIfNone: false });
        if (!session) {
            return null;
        }
        const response = await fetch("https://api.github.com/copilot_internal/user", {
            headers: {
                Authorization: `Bearer ${session.accessToken}`,
                "User-Agent": "VSCode-Copilot-Token-Meter",
                "Accept": "application/json"
            }
        });
        if (!response.ok) {
            console.error("[Copilot Meter] API error:", response.status, await response.text());
            return null;
        }
        const data = await response.json();
        let targetSnapshot;
        let type = 'premium';
        let subscriptionStartDay = data.limited_user_subscribed_day;
        if (data.quota_snapshots) {
            const snapshots = data.quota_snapshots;
            targetSnapshot = snapshots.premium_interactions;
            if (!targetSnapshot || typeof targetSnapshot.entitlement !== 'number' || targetSnapshot.entitlement === 0) {
                targetSnapshot = snapshots.chat_messages;
                type = 'chat';
                if (!targetSnapshot || typeof targetSnapshot.entitlement !== 'number' || targetSnapshot.entitlement === 0) {
                    // Fallback to any snapshot containing 'chat' in its key
                    const fallbackKey = Object.keys(snapshots).find(k => k.toLowerCase().includes('chat') && snapshots[k] && typeof snapshots[k].entitlement === 'number' && snapshots[k].entitlement > 0);
                    if (fallbackKey) {
                        targetSnapshot = snapshots[fallbackKey];
                        type = 'chat';
                    }
                }
            }
        }
        else if (data.monthly_quotas && data.limited_user_quotas && typeof data.monthly_quotas.chat === 'number' && typeof data.limited_user_quotas.chat === 'number') {
            targetSnapshot = {
                entitlement: data.monthly_quotas.chat,
                quota_remaining: data.limited_user_quotas.chat
            };
            type = 'chat';
        }
        if (!targetSnapshot || typeof targetSnapshot.entitlement !== 'number' || targetSnapshot.entitlement === 0) {
            console.error("[Copilot Meter] No valid quota snapshot found. Available keys:", Object.keys(data));
            vscode.window.showErrorMessage(`[Copilot Meter Debug] Unrecognized API format: ${JSON.stringify(data)}`);
            return null;
        }
        const { entitlement, quota_remaining } = targetSnapshot;
        const used = entitlement - quota_remaining;
        const percentage = (used / entitlement) * 100;
        return {
            percentage: Math.round(percentage * 10) / 10,
            used,
            entitlement,
            type,
            subscriptionStartDay
        };
    }
    catch (error) {
        console.error("[Copilot Meter] Error fetching data:", error);
        vscode.window.showErrorMessage(`[Copilot Meter Debug] Fetch Error: ${error}`);
        return null;
    }
}
function getSubscriptionMonthBounds(startDay) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let startMonth = now.getMonth();
    let startYear = now.getFullYear();
    if (now.getDate() < startDay) {
        startMonth--;
        if (startMonth < 0) {
            startMonth = 11;
            startYear--;
        }
    }
    const start = new Date(startYear, startMonth, startDay);
    start.setHours(0, 0, 0, 0);
    const end = new Date(startYear, startMonth + 1, startDay);
    end.setHours(0, 0, 0, 0);
    return { start, end };
}
function getElapsedWorkingDays(start, current) {
    let workingDays = 0;
    const date = new Date(start);
    date.setHours(0, 0, 0, 0);
    const endDate = new Date(current);
    endDate.setHours(23, 59, 59, 999);
    if (date > endDate) {
        return 0; // Current date is before start date
    }
    while (date <= endDate) {
        const day = date.getDay();
        if (day !== 0 && day !== 6) {
            workingDays++;
        }
        date.setDate(date.getDate() + 1);
    }
    return workingDays;
}
function getTotalWorkingDaysInBounds(start, end) {
    let workingDays = 0;
    const date = new Date(start);
    date.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(0, 0, 0, 0);
    while (date < endDate) {
        const day = date.getDay();
        if (day !== 0 && day !== 6) {
            workingDays++;
        }
        date.setDate(date.getDate() + 1);
    }
    return workingDays;
}
function generateProgressBar(percentage, length = 10) {
    const p = Math.max(0, Math.min(100, Math.floor(percentage)));
    const filledLength = Math.round((length * p) / 100);
    const emptyLength = length - filledLength;
    const filledStr = '█'.repeat(filledLength);
    const emptyStr = '░'.repeat(emptyLength);
    return `[${filledStr}${emptyStr}]`;
}
async function updateMeter(statusBarItem, context) {
    statusBarItem.show();
    const session = await vscode.authentication.getSession("github", ["user:email"], { createIfNone: false });
    if (!session) {
        statusBarItem.text = `$(mark-github) Sign in to track Copilot usage`;
        statusBarItem.tooltip = `Click to sign in and track your GitHub Copilot premium requests.`;
        statusBarItem.backgroundColor = undefined;
        statusBarItem.command = 'copilotMeter.signIn';
        return;
    }
    statusBarItem.command = undefined;
    const usage = await fetchUsageData(context);
    if (!usage) {
        statusBarItem.text = `$(warning) Copilot Meter (Error)`;
        statusBarItem.tooltip = `Failed to fetch usage data from GitHub.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        return;
    }
    const config = vscode.workspace.getConfiguration('copilotMeter');
    let totalLimit = config.get('monthlyTokenLimit', 300);
    const startDay = usage.subscriptionStartDay || config.get('subscriptionStartDay', 1);
    const now = new Date();
    const { start, end } = getSubscriptionMonthBounds(startDay);
    const totalWorkingDays = getTotalWorkingDaysInBounds(start, end);
    const elapsedWorkingDays = getElapsedWorkingDays(start, now);
    // Use entitlement from API output over arbitrary configuration limit if available
    totalLimit = usage.entitlement > 0 ? usage.entitlement : totalLimit;
    let dailyLimit = totalLimit / totalWorkingDays;
    let allowedUsageTillToday = dailyLimit * elapsedWorkingDays;
    // Avoid division by zero edge-cases
    if (allowedUsageTillToday <= 0)
        allowedUsageTillToday = 1;
    const percentageOfAllowed = (usage.used / allowedUsageTillToday) * 100;
    const isOverLimit = usage.used > allowedUsageTillToday;
    const progressBar = generateProgressBar(percentageOfAllowed, 10);
    const label = usage.type === 'chat' ? 'Copilot Chat' : 'Copilot';
    statusBarItem.text = `${label}: ${Math.round(percentageOfAllowed)}% ${progressBar}`;
    // Tooltip with detailed stats
    const metricName = usage.type === 'chat' ? 'Chat Messages' : 'Tokens';
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${label} Daily Meter**\n\n`);
    tooltip.appendMarkdown(`- Subscription Cycle: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}\n`);
    tooltip.appendMarkdown(`- Working Days Elapsed: ${elapsedWorkingDays} / ${totalWorkingDays}\n`);
    tooltip.appendMarkdown(`- Total Allowable ${metricName} by Today: **${Math.round(allowedUsageTillToday)}** (Daily Limit: ${dailyLimit.toFixed(1)})\n`);
    tooltip.appendMarkdown(`- Actual ${metricName} Used: **${usage.used}** / ${totalLimit}\n\n`);
    if (isOverLimit) {
        tooltip.appendMarkdown(`⚠️ **Warning:** You have exceeded your daily internal limit tracking! Your usage will be colored red.\n`);
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
    else {
        statusBarItem.backgroundColor = undefined;
    }
    statusBarItem.tooltip = tooltip;
}
//# sourceMappingURL=meter.js.map