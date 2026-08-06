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
        return 'background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0;';
      }
      if (s === 'rejected' || s === 'failed') {
        return 'background:#fee2e2;color:#ef4444;border:1px solid #fecaca;';
      }
      return 'background:#fef3c7;color:#d97706;border:1px solid #fde68a;';
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
            <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;">${dateStr}</td>
            <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#111827;">${typeLabel}</td>
            <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-family:monospace;font-size:12px;">${refId}</td>
            <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;text-align:center;">
              <span class="status-badge" style="${getStatusBadgeStyle(tx.status)}">${statusLabel}</span>
            </td>
            <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;text-align:right;color:${
              isCredit ? '#16a34a' : '#ef4444'
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
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; }
        body { 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
          color: #1f2937; 
          margin: 0; 
          padding: 40px; 
          background: #ffffff; 
          line-height: 1.5;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          border-bottom: 2px solid #0E3D23; 
          padding-bottom: 20px; 
          margin-bottom: 30px; 
        }
        .logo { 
          font-size: 32px; 
          font-weight: 800; 
          color: #0E3D23; 
          letter-spacing: -1px; 
        }
        .logo span { color: #D4A843; }
        .title { 
          font-size: 13px; 
          font-weight: 800; 
          color: #6b7280; 
          text-transform: uppercase; 
          letter-spacing: 1.5px; 
          border: 1.5px solid #e5e7eb;
          padding: 8px 20px;
          border-radius: 99px;
          background: #f8fafc;
        }
        
        .user-info { 
          display: flex; 
          justify-content: space-between; 
          background: #f4f7f5; 
          border: 1px solid #e2e8f0; 
          border-radius: 16px; 
          padding: 24px; 
          margin-bottom: 30px; 
        }
        .info-col { flex: 1; }
        .info-col p { margin: 6px 0; font-size: 14px; color: #4b5563; }
        .info-col p strong { color: #0E3D23; font-weight: 600; }

        .summary-grid { 
          display: flex;
          gap: 16px; 
          margin-bottom: 35px; 
        }
        .summary-card { 
          flex: 1;
          background: #ffffff; 
          border: 1px solid #e2e8f0; 
          border-radius: 16px; 
          padding: 18px 20px; 
          text-align: left;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01);
        }
        .summary-card .label { 
          font-size: 10px; 
          font-weight: 700; 
          color: #94a3b8; 
          text-transform: uppercase; 
          margin-bottom: 8px; 
          letter-spacing: 0.5px;
        }
        .summary-card .val { 
          font-size: 18px; 
          font-weight: 800; 
          color: #0E3D23; 
        }
        .summary-card.withdraw .val {
          color: #dc2626;
        }

        table { width: 100%; border-collapse: collapse; margin-bottom: 35px; }
        tr { page-break-inside: avoid; }
        th { 
          background: #0E3D23; 
          color: #ffffff; 
          font-size: 11px; 
          font-weight: 700; 
          text-transform: uppercase; 
          padding: 14px 16px; 
          text-align: left; 
          letter-spacing: 0.5px;
        }
        th:first-child { border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
        th:last-child { border-top-right-radius: 8px; border-bottom-right-radius: 8px; text-align: right; }
        th:nth-child(4) { text-align: center; }

        td { padding: 16px; font-size: 13px; border-bottom: 1px solid #e2e8f0; color: #374151; }
        td:last-child { text-align: right; font-weight: 700; }
        td:nth-child(2) { font-weight: 600; color: #111827; }
        td:nth-child(4) { text-align: center; }

        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 99px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }

        .footer { 
          border-top: 1px solid #e2e8f0; 
          padding-top: 24px; 
          text-align: center; 
          font-size: 12px; 
          color: #94a3b8; 
          margin-top: 50px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">Grow<span>vest</span></div>
        <div class="title">Account Statement</div>
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
        <div class="summary-card withdraw">
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
          ${tableRowsHtml.length > 0 ? tableRowsHtml : `<tr><td colspan="5" style="text-align:center;padding:30px;color:#94a3b8;">No transactions found</td></tr>`}
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
