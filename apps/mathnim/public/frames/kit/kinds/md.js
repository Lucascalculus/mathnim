// **bold** to <b>, after escaping: the instruments' texts are plain strings with this one mark.
window.md = function (s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]; }).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); };
