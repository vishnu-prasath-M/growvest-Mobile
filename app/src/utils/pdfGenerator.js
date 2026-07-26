import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export const generateAndShareTransactionStatement = async (user, transactions) => {
  try {
    const generatedDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Calculate totals
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalChitPayments = 0;
    let totalInvestments = 0;

    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'investment') {
        totalInvestments += amt;
        totalDeposits += amt;
      } else if (tx.type === 'chit_join' || tx.type === 'chit_payment') {
        totalChitPayments += amt;
        totalDeposits += amt;
      } else if (tx.type === 'withdrawal') {
        totalWithdrawals += amt;
      }
    });

    const formatCurrency = (val) =>
      `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const getTxTypeLabel = (type) => {
      switch (type) {
        case 'investment':
          return 'Investment Deposit';
        case 'withdrawal':
          return 'Withdrawal';
        case 'chit_join':
          return 'Chit Fund Join';
        case 'chit_payment':
          return 'Chit Monthly Due';
        default:
          return type || 'Transaction';
      }
    };

    const getStatusBadgeStyle = (status) => {
      const s = (status || '').toLowerCase();
      if (s === 'approved' || s === 'completed' || s === 'paid') {
        return 'background:#dcfce7;color:#15803d;';
      }
      if (s === 'rejected' || s === 'failed') {
        return 'background:#fee2e2;color:#b91c1c;';
      }
      return 'background:#fef3c7;color:#b45309;';
    };

    const tableRowsHtml = transactions
      .map((tx, idx) => {
        const dateStr = tx.createdAt
          ? new Date(tx.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : 'N/A';
        const typeLabel = getTxTypeLabel(tx.type);
        const statusLabel = (tx.status || 'Pending').toUpperCase();
        const refId = tx.referenceId || tx._id || 'N/A';
        const isCredit = ['investment', 'chit_join', 'chit_payment'].includes(tx.type);
        const amtStr = `${isCredit ? '+' : '-'} ${formatCurrency(Number(tx.amount) || 0)}`;

        return `
          <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8faf9'};">
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151;">${dateStr}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:600;color:#111827;">${typeLabel}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#6b7280;font-family:monospace;">${refId}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">
              <span style="display:inline-block;padding:3px 8px;border-radius:12px;font-size:10px;font-weight:700;${getStatusBadgeStyle(
                tx.status
              )}">${statusLabel}</span>
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:700;text-align:right;color:${
              isCredit ? '#16a34a' : '#1f2937'
            };">${amtStr}</td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Account Statement - Growvest</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 24px; background: #ffffff; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0E3D23; padding-bottom: 16px; margin-bottom: 20px; }
        .logo { font-size: 26px; font-weight: 800; color: #0E3D23; letter-spacing: -0.5px; }
        .logo span { color: #D4A843; }
        .title { font-size: 14px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 1px; }
        
        .user-info { display: flex; justify-content: space-between; background: #f8faf9; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
        .info-col p { margin: 3px 0; font-size: 13px; color: #4b5563; }
        .info-col p strong { color: #111827; }

        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .summary-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; text-align: center; }
        .summary-card .label { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
        .summary-card .val { font-size: 14px; font-weight: 800; color: #0E3D23; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #0E3D23; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 10px 12px; text-align: left; }
        th:nth-child(4) { text-align: center; }
        th:nth-child(5) { text-align: right; }

        .footer { border-top: 1px solid #e5e7eb; padding-top: 16px; text-align: center; font-size: 11px; color: #9ca3af; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">Grow<span>vest</span></div>
        <div class="title">ACCOUNT STATEMENT</div>
      </div>

      <div class="user-info">
        <div class="info-col">
          <p><strong>Account Holder:</strong> ${user?.name || user?.username || 'Valued User'}</p>
          <p><strong>Email:</strong> ${user?.email || 'N/A'}</p>
          <p><strong>Mobile:</strong> ${user?.mobileNumber || 'N/A'}</p>
        </div>
        <div class="info-col" style="text-align:right;">
          <p><strong>Generated Date:</strong> ${generatedDate}</p>
          <p><strong>Total Transactions:</strong> ${transactions.length}</p>
        </div>
      </div>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="label">Total Deposits</div>
          <div class="val">${formatCurrency(totalDeposits)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Total Withdrawals</div>
          <div class="val">${formatCurrency(totalWithdrawals)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Chit Payments</div>
          <div class="val">${formatCurrency(totalChitPayments)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Investments</div>
          <div class="val">${formatCurrency(totalInvestments)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Reference ID</th>
            <th style="text-align:center;">Status</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml.length > 0 ? tableRowsHtml : `<tr><td colspan="5" style="text-align:center;padding:20px;color:#6b7280;">No transactions found</td></tr>`}
        </tbody>
      </table>

      <div class="footer">
        This is an official computer-generated statement from Growvest. For support, contact support@growvest.in
      </div>
    </body>
    </html>
    `;

    const { uri } = await Print.printToFileAsync({ html: htmlContent });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Share Account Statement PDF',
      });
    } else {
      Alert.alert('Statement Generated', `PDF saved at:\n${uri}`);
    }
  } catch (err) {
    console.error('Failed to generate PDF statement:', err);
    Alert.alert('Error', 'Failed to generate PDF statement. Please try again.');
  }
};
