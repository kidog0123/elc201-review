/* ========================================================
   FUSTATION ELC201 Interactive Review System
   Full Text & Math Engine with Mobile Flanks & CDN Images
   ======================================================== */

// Global State
let currentExam = null;
let currentQuestionIndex = 0;
let filterMode = 'all'; // 'all' | 'saved'
let imageDisplayMode = 'auto'; // 'auto' | 'always' | 'never'
let savedQuestionIds = new Set();
let examAnswers = {}; // { examId: { qId: { selected: 'A', isCorrect: true, answeredAt: timestamp } } }

// Online GitHub Pages CDN for images - NO NEED TO UPLOAD 200 IMAGES!
const ONLINE_IMAGE_BASE = 'https://vuminhtuan-cdm.github.io/elc201-fe/images/';
const FALLBACK_IMAGE_BASE = 'https://raw.githubusercontent.com/vuminhtuan-cdm/elc201-fe/main/images/';

function resolveImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const filename = url.split('/').pop();
    return ONLINE_IMAGE_BASE + filename;
}

// Load saved data from localStorage
function loadLocalState() {
    try {
        const savedBookmarks = localStorage.getItem('elc201_bookmarks');
        if (savedBookmarks) {
            savedQuestionIds = new Set(JSON.parse(savedBookmarks));
        }

        const savedAns = localStorage.getItem('elc201_answers');
        if (savedAns) {
            examAnswers = JSON.parse(savedAns);
        }

        const savedMode = localStorage.getItem('elc201_img_mode');
        if (savedMode) {
            imageDisplayMode = savedMode;
        }
    } catch (err) {
        console.warn('LocalStorage error:', err);
    }
}

function saveLocalState() {
    try {
        localStorage.setItem('elc201_bookmarks', JSON.stringify(Array.from(savedQuestionIds)));
        localStorage.setItem('elc201_answers', JSON.stringify(examAnswers));
        localStorage.setItem('elc201_img_mode', imageDisplayMode);
    } catch (err) {
        console.warn('LocalStorage save error:', err);
    }
}

// Helper to get text content & diagram state for a question
function getQuestionData(q) {
    if (q.content && q.content.trim().length > 0) {
        return {
            title: q.content,
            options: q.options || [],
            imageUrl: q.image_url,
            hasDiagram: false
        };
    }

    if (q.image_url && typeof EXTRACTED_QUESTIONS !== 'undefined') {
        const filename = q.image_url.split('/').pop();
        const extracted = EXTRACTED_QUESTIONS[filename];

        if (extracted) {
            let hasEmptyOpt = false;
            const opts = ['A', 'B', 'C', 'D'].map(letter => {
                let optText = extracted.options ? (extracted.options[letter] || '') : '';
                optText = optText.trim();
                if (!optText) {
                    hasEmptyOpt = true;
                    optText = `Phương án ${letter} (Xem trên hình ảnh)`;
                }
                return {
                    label: letter,
                    content: optText,
                    is_correct: letter === q.correct_answer
                };
            });

            const titleLower = (extracted.question || '').toLowerCase();
            const diagRegex = /(figure|circuit|schematic|curve|graph|table|diagram|shown|referring to|refer to|following figure|this circuit|waveform|calculate|determine|network|characteristic)/i;
            const hasDiagram = Boolean(extracted.has_diagram || diagRegex.test(titleLower) || hasEmptyOpt || !extracted.question || extracted.question.length < 15);

            return {
                title: extracted.question || 'Câu hỏi trắc nghiệm ELC201 (Xem hình vẽ bên dưới):',
                options: opts,
                imageUrl: q.image_url,
                hasDiagram: hasDiagram
            };
        }
    }

    const fallbackOpts = ['A', 'B', 'C', 'D'].map(l => ({
        label: l,
        content: `Phương án ${l} (Xem trên hình ảnh)`,
        is_correct: l === q.correct_answer
    }));

    return {
        title: 'Câu hỏi trắc nghiệm (Xem hình sơ đồ bên dưới):',
        options: fallbackOpts,
        imageUrl: q.image_url,
        hasDiagram: true
    };
}

// DOM Elements
const dashboardView = document.getElementById('dashboardView');
const practiceView = document.getElementById('practiceView');
const examCardsGrid = document.getElementById('examCardsGrid');
const brandHome = document.getElementById('brandHome');
const btnBackToCourse = document.getElementById('btnBackToCourse');

// Practice View Elements
const examTypeBadge = document.getElementById('examTypeBadge');
const examMainTitle = document.getElementById('examMainTitle');
const examSubInfo = document.getElementById('examSubInfo');
const btnResetExam = document.getElementById('btnResetExam');
const btnShuffleExam = document.getElementById('btnShuffleExam');
const btnRestoreExam = document.getElementById('btnRestoreExam');
const shuffleExamLabel = document.getElementById('shuffleExamLabel');
const btnShuffleCard = document.getElementById('btnShuffleCard');
const btnMobShuffleDrawer = document.getElementById('btnMobShuffleDrawer');
const toastNotice = document.getElementById('toastNotice');
const btnCheatsheet = document.getElementById('btnCheatsheet');
const modalCheatsheet = document.getElementById('modalCheatsheet');
const btnCloseModal = document.getElementById('btnCloseModal');

// Flanking Prev / Next buttons on two sides of the question
const btnFlankPrev = document.getElementById('btnFlankPrev');
const btnFlankNext = document.getElementById('btnFlankNext');

// Mobile Sticky Bar & Drawer
const mobileStickyBar = document.getElementById('mobileStickyBar');
const btnMobPrev = document.getElementById('btnMobPrev');
const btnMobNext = document.getElementById('btnMobNext');
const btnMobMatrixToggle = document.getElementById('btnMobMatrixToggle');
const mobCurrentNum = document.getElementById('mobCurrentNum');
const mobTotalNum = document.getElementById('mobTotalNum');
const modalMobileMatrix = document.getElementById('modalMobileMatrix');
const btnCloseMobMatrix = document.getElementById('btnCloseMobMatrix');
const questionGridMobile = document.getElementById('questionGridMobile');
const mobDrawerCurrent = document.getElementById('mobDrawerCurrent');
const mobDrawerTotal = document.getElementById('mobDrawerTotal');
const mobCorrect = document.getElementById('mobCorrect');
const mobWrong = document.getElementById('mobWrong');

// Inline Diagram Card
const diagramInlineCard = document.getElementById('diagramInlineCard');
const diagramCardTitle = document.getElementById('diagramCardTitle');
const diagramInlineImg = document.getElementById('diagramInlineImg');
const diagramImgFrame = document.getElementById('diagramImgFrame');
const btnZoomDiagram = document.getElementById('btnZoomDiagram');

// Lightbox Modal
const modalDiagramLightbox = document.getElementById('modalDiagramLightbox');
const lightboxImg = document.getElementById('lightboxImg');
const btnCloseLightbox = document.getElementById('btnCloseLightbox');
const lightboxTitle = document.getElementById('lightboxTitle');

// Top action buttons inside question card
const btnToggleImageMode = document.getElementById('btnToggleImageMode');
const imgModeLabel = document.getElementById('imgModeLabel');
const btnBookmarkQ = document.getElementById('btnBookmarkQ');
const btnFlagQ = document.getElementById('btnFlagQ');

// Sidebar Elements (Desktop)
const qIndexText = document.getElementById('qIndexText');
const qTotalText = document.getElementById('qTotalText');
const btnPrevQ = document.getElementById('btnPrevQ');
const btnNextQ = document.getElementById('btnNextQ');
const btnToggleCollapse = document.getElementById('btnToggleCollapse');
const questionGridContainer = document.getElementById('questionGridContainer');
const filterAll = document.getElementById('filterAll');
const filterSaved = document.getElementById('filterSaved');
const filterAllCount = document.getElementById('filterAllCount');
const questionGrid = document.getElementById('questionGrid');

// Sidebar score
const sideCorrectCount = document.getElementById('sideCorrectCount');
const sideWrongCount = document.getElementById('sideWrongCount');
const sideRemainCount = document.getElementById('sideRemainCount');
const miniProgressFill = document.getElementById('miniProgressFill');

// Question Card Elements
const questionCard = document.getElementById('questionCard');
const questionPrompt = document.getElementById('questionPrompt');
const optionsList = document.getElementById('optionsList');
const answerFeedbackPanel = document.getElementById('answerFeedbackPanel');
const feedbackStatusRow = document.getElementById('feedbackStatusRow');
const feedbackIcon = document.getElementById('feedbackIcon');
const feedbackMsgText = document.getElementById('feedbackMsgText');
const correctBadgeValue = document.getElementById('correctBadgeValue');
const correctContentText = document.getElementById('correctContentText');

// Dashboard Overall Stats
const totalQuestionsCount = document.getElementById('totalQuestionsCount');
const totalAnsweredCount = document.getElementById('totalAnsweredCount');
const overallAccuracy = document.getElementById('overallAccuracy');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadLocalState();
    updateImageModeLabel();
    initDashboard();
    setupGlobalEvents();
    setupTouchGestures();
});

function updateImageModeLabel() {
    if (!imgModeLabel) return;
    if (imageDisplayMode === 'auto') {
        imgModeLabel.textContent = 'Hình: Tự động';
    } else if (imageDisplayMode === 'always') {
        imgModeLabel.textContent = 'Hình: Luôn hiện';
    } else {
        imgModeLabel.textContent = 'Hình: Ẩn';
    }
}

function initDashboard() {
    renderDashboardStats();
    renderExamCards();
}

function renderDashboardStats() {
    let totalQ = 0;
    let totalAnswered = 0;
    let totalCorrect = 0;

    EXAMS_DATA.forEach(exam => {
        if (exam.id === 'exam_all') return;
        totalQ += exam.questions.length;
        const examAns = examAnswers[exam.id] || {};
        Object.values(examAns).forEach(ans => {
            totalAnswered++;
            if (ans.isCorrect) totalCorrect++;
        });
    });

    if (totalQuestionsCount) totalQuestionsCount.textContent = totalQ;
    if (totalAnsweredCount) totalAnsweredCount.textContent = totalAnswered;
    if (overallAccuracy) {
        const acc = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
        overallAccuracy.textContent = `${acc}%`;
    }
}

function renderExamCards() {
    examCardsGrid.innerHTML = '';

    EXAMS_DATA.forEach(exam => {
        const isAll = exam.id === 'exam_all';
        const qCount = exam.questions.length;
        
        const ansMap = examAnswers[exam.id] || {};
        const answeredCount = Object.keys(ansMap).length;
        const correctCount = Object.values(ansMap).filter(a => a.isCorrect).length;

        let typeBadgeClass = 're';
        let typeBadgeLabel = 'Re-Exam';
        if (isAll) {
            typeBadgeClass = 'all';
            typeBadgeLabel = 'Bộ Tổng Hợp';
        } else if (exam.code.includes('FE')) {
            typeBadgeClass = 'final';
            typeBadgeLabel = 'Final Exam';
        }

        const formatLabel = 'Chữ & Sơ đồ trực tiếp';

        const card = document.createElement('div');
        card.className = 'exam-card-item';
        card.innerHTML = `
            <div class="card-tag-row">
                <span class="badge-exam-type ${typeBadgeClass}">${typeBadgeLabel}</span>
                <span class="badge-exam-format">${formatLabel}</span>
            </div>
            <h3 class="exam-item-title">${exam.code}</h3>
            <p class="exam-item-subtitle">${exam.title}</p>
            <div class="exam-item-footer">
                <div class="exam-item-progress-text">
                    ${answeredCount > 0 ? `Tiến độ: ${answeredCount}/${qCount} (${correctCount} đúng)` : `${qCount} câu hỏi chữ & sơ đồ`}
                </div>
                <button class="btn-start-exam">
                    <span>Luyện tập</span>
                    <span>→</span>
                </button>
            </div>
        `;

        card.addEventListener('click', () => openExam(exam.id));
        examCardsGrid.appendChild(card);
    });
}

function openExam(examId, startIndex = 0) {
    currentExam = EXAMS_DATA.find(e => e.id === examId) || EXAMS_DATA[0];
    currentQuestionIndex = startIndex;
    filterMode = 'all';

    // Backup original questions order once
    if (!currentExam._originalQuestions) {
        currentExam._originalQuestions = [...currentExam.questions];
    }

    // Header metadata
    if (examMainTitle) examMainTitle.textContent = currentExam.code;
    if (examSubInfo) examSubInfo.textContent = currentExam.shortTitle || 'HOLA';

    if (examTypeBadge) {
        if (currentExam.code.includes('FE')) {
            examTypeBadge.textContent = 'Final Exam';
            examTypeBadge.className = 'tag-badge tag-green';
        } else if (currentExam.id === 'exam_all') {
            examTypeBadge.textContent = 'Tổng hợp 250 câu';
            examTypeBadge.className = 'tag-badge tag-gray';
        } else {
            examTypeBadge.textContent = 'Re-Exam';
            examTypeBadge.className = 'tag-badge tag-gray';
        }
    }

    if (qTotalText) qTotalText.textContent = currentExam.questions.length;
    if (mobTotalNum) mobTotalNum.textContent = currentExam.questions.length;
    if (mobDrawerTotal) mobDrawerTotal.textContent = currentExam.questions.length;
    if (filterAllCount) filterAllCount.textContent = currentExam.questions.length;

    // Switch views
    dashboardView.style.display = 'none';
    practiceView.style.display = 'block';
    if (mobileStickyBar) mobileStickyBar.style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    renderQuestionGrid();
    renderCurrentQuestion();
    updateSidebarStats();
    updateShuffleUI();
}

function closeExam() {
    currentExam = null;
    practiceView.style.display = 'none';
    if (mobileStickyBar) mobileStickyBar.style.display = 'none';
    dashboardView.style.display = 'block';
    initDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderQuestionGrid() {
    if (!currentExam) return;
    questionGrid.innerHTML = '';
    if (questionGridMobile) questionGridMobile.innerHTML = '';

    const questions = currentExam.questions;
    const ansMap = examAnswers[currentExam.id] || {};

    questions.forEach((q, idx) => {
        const isSaved = savedQuestionIds.has(q.id);
        if (filterMode === 'saved' && !isSaved) return;

        // Desktop Box
        const box = document.createElement('div');
        box.className = 'q-box';
        box.textContent = idx + 1;
        box.dataset.index = idx;

        // Mobile Box
        const mobBox = document.createElement('div');
        mobBox.className = 'q-box';
        mobBox.textContent = idx + 1;
        mobBox.dataset.index = idx;

        if (idx === currentQuestionIndex) {
            box.classList.add('current');
            mobBox.classList.add('current');
        }

        const ans = ansMap[q.id];
        if (ans) {
            const cls = ans.isCorrect ? 'correct' : 'wrong';
            box.classList.add(cls);
            mobBox.classList.add(cls);
        }

        if (isSaved) {
            box.classList.add('bookmarked');
            mobBox.classList.add('bookmarked');
        }

        const clickHandler = () => {
            currentQuestionIndex = idx;
            renderCurrentQuestion();
            highlightActiveGridBox();
            if (modalMobileMatrix) modalMobileMatrix.style.display = 'none';
        };

        box.addEventListener('click', clickHandler);
        mobBox.addEventListener('click', clickHandler);

        questionGrid.appendChild(box);
        if (questionGridMobile) questionGridMobile.appendChild(mobBox);
    });
}

function highlightActiveGridBox() {
    const updateBoxes = (container) => {
        if (!container) return;
        const boxes = container.querySelectorAll('.q-box');
        boxes.forEach(box => {
            const idx = parseInt(box.dataset.index, 10);
            if (idx === currentQuestionIndex) {
                box.classList.add('current');
            } else {
                box.classList.remove('current');
            }
        });
    };

    updateBoxes(questionGrid);
    updateBoxes(questionGridMobile);

    const qNum = currentQuestionIndex + 1;
    if (qIndexText) qIndexText.textContent = qNum;
    if (mobCurrentNum) mobCurrentNum.textContent = qNum;
    if (mobDrawerCurrent) mobDrawerCurrent.textContent = qNum;

    const isFirst = currentQuestionIndex === 0;
    const isLast = currentExam ? currentQuestionIndex >= currentExam.questions.length - 1 : true;

    if (btnPrevQ) btnPrevQ.disabled = isFirst;
    if (btnNextQ) btnNextQ.disabled = isLast;
    if (btnFlankPrev) btnFlankPrev.disabled = isFirst;
    if (btnFlankNext) btnFlankNext.disabled = isLast;
    if (btnMobPrev) btnMobPrev.disabled = isFirst;
    if (btnMobNext) btnMobNext.disabled = isLast;
}

function openLightbox(imgUrl, title) {
    if (!lightboxImg || !modalDiagramLightbox) return;
    lightboxImg.src = imgUrl;
    if (lightboxTitle) lightboxTitle.textContent = title || '🔍 Sơ đồ mạch & Hình vẽ chi tiết';
    modalDiagramLightbox.style.display = 'flex';
}

function goToQuestion(idx) {
    if (!currentExam) return;
    if (idx >= 0 && idx < currentExam.questions.length) {
        currentQuestionIndex = idx;
        renderCurrentQuestion();
        window.scrollTo({ top: 120, behavior: 'smooth' });
    }
}

function renderCurrentQuestion() {
    if (!currentExam) return;
    const q = currentExam.questions[currentQuestionIndex];
    if (!q) return;

    highlightActiveGridBox();

    // Bookmark tool icon state
    const isSaved = savedQuestionIds.has(q.id);
    if (btnBookmarkQ) {
        if (isSaved) {
            btnBookmarkQ.classList.add('active-bookmark');
            btnBookmarkQ.title = 'Bỏ lưu câu hỏi này';
        } else {
            btnBookmarkQ.classList.remove('active-bookmark');
            btnBookmarkQ.title = 'Lưu câu hỏi này';
        }
    }

    // Parse question data into text, options & diagram state
    const qData = getQuestionData(q);

    // 1. Render Question Body in Large Clean Text
    let rawContent = qData.title || '';
    const formatted = rawContent
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>');
    questionPrompt.innerHTML = `<p>${formatted}</p>`;
    renderMath(questionPrompt);

    // 2. Render Inline Diagram Card (Loaded from CDN - No local images needed!)
    const shouldShowDiagram = q.image_url && (
        imageDisplayMode === 'always' ||
        (imageDisplayMode === 'auto' && qData.hasDiagram)
    );

    if (shouldShowDiagram) {
        const fullImgUrl = resolveImageUrl(q.image_url);
        diagramInlineCard.style.display = 'block';
        diagramInlineImg.src = fullImgUrl;
        diagramInlineImg.onerror = () => {
            const fname = q.image_url.split('/').pop();
            diagramInlineImg.src = FALLBACK_IMAGE_BASE + fname;
        };
        diagramCardTitle.textContent = `Sơ đồ mạch / Hình vẽ câu ${currentQuestionIndex + 1}`;
        
        const zoomFn = () => openLightbox(fullImgUrl, `🔍 Sơ đồ mạch câu ${currentQuestionIndex + 1} (${currentExam.code})`);
        diagramImgFrame.onclick = zoomFn;
        btnZoomDiagram.onclick = zoomFn;
    } else {
        diagramInlineCard.style.display = 'none';
    }

    // Existing Answer
    const ansMap = examAnswers[currentExam.id] || {};
    const existingAnswer = ansMap[q.id];

    // 3. Render Options A, B, C, D in Large Legible Row Buttons
    optionsList.innerHTML = '';
    const optionsData = qData.options;

    optionsData.forEach(opt => {
        const label = opt.label || 'A';
        const contentText = opt.content ? opt.content.trim() : `Phương án ${label}`;

        const row = document.createElement('div');
        row.className = 'option-row';
        row.dataset.label = label;

        row.innerHTML = `
            <div class="option-letter-badge">${label}</div>
            <div class="option-text-body">${contentText}</div>
        `;

        if (existingAnswer) {
            row.classList.add('locked');
            if (label === existingAnswer.selected) {
                if (existingAnswer.isCorrect) {
                    row.classList.add('is-selected-correct');
                } else {
                    row.classList.add('is-selected-wrong');
                }
            } else if (label === q.correct_answer && !existingAnswer.isCorrect) {
                row.classList.add('is-revealed-correct');
            }
        } else {
            row.addEventListener('click', () => handleSelectOption(label, qData));
        }

        renderMath(row);
        optionsList.appendChild(row);
    });

    // 4. Render Feedback Panel
    if (existingAnswer) {
        showFeedback(existingAnswer.isCorrect, q.correct_answer, existingAnswer.selected, qData);
    } else {
        answerFeedbackPanel.style.display = 'none';
    }
}

function handleSelectOption(selectedLabel, qData) {
    if (!currentExam) return;
    const q = currentExam.questions[currentQuestionIndex];
    if (!q) return;

    if (!examAnswers[currentExam.id]) {
        examAnswers[currentExam.id] = {};
    }

    if (examAnswers[currentExam.id][q.id]) return;

    const isCorrect = selectedLabel === q.correct_answer;

    examAnswers[currentExam.id][q.id] = {
        selected: selectedLabel,
        isCorrect: isCorrect,
        answeredAt: Date.now()
    };

    saveLocalState();
    renderCurrentQuestion();
    renderQuestionGrid();
    updateSidebarStats();
}

function showFeedback(isCorrect, correctLetter, selectedLetter, qData) {
    answerFeedbackPanel.style.display = 'block';

    if (isCorrect) {
        answerFeedbackPanel.className = 'answer-feedback-panel';
        feedbackIcon.textContent = '✓';
        feedbackMsgText.textContent = 'Bạn đã chọn đúng!';
    } else {
        answerFeedbackPanel.className = 'answer-feedback-panel wrong-alert';
        feedbackIcon.textContent = '✗';
        feedbackMsgText.textContent = `Bạn đã chọn sai! (Bạn chọn: ${selectedLetter})`;
    }

    correctBadgeValue.textContent = correctLetter;

    let correctText = '';
    if (qData && qData.options) {
        const found = qData.options.find(o => o.label === correctLetter);
        if (found && found.content && !found.content.startsWith('Phương án')) {
            correctText = found.content;
        }
    }
    correctContentText.innerHTML = correctText ? `<span style="font-weight:700;">Nội dung:</span> ${correctText}` : '';
    if (correctText) renderMath(correctContentText);
}

function updateSidebarStats() {
    if (!currentExam) return;
    const total = currentExam.questions.length;
    const ansMap = examAnswers[currentExam.id] || {};
    
    let correct = 0;
    let wrong = 0;
    Object.values(ansMap).forEach(a => {
        if (a.isCorrect) correct++;
        else wrong++;
    });

    const answered = correct + wrong;
    const remain = total - answered;
    const pct = total > 0 ? (answered / total) * 100 : 0;

    if (sideCorrectCount) sideCorrectCount.textContent = correct;
    if (sideWrongCount) sideWrongCount.textContent = wrong;
    if (sideRemainCount) sideRemainCount.textContent = remain;
    if (miniProgressFill) miniProgressFill.style.width = `${pct}%`;

    if (mobCorrect) mobCorrect.textContent = correct;
    if (mobWrong) mobWrong.textContent = wrong;
}

function renderMath(element) {
    if (window.renderMathInElement) {
        try {
            window.renderMathInElement(element, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\[', right: '\\]', display: true },
                    { left: '\\(', right: '\\)', display: false }
                ],
                throwOnError: false
            });
        } catch (e) {
            console.error('KaTeX rendering error:', e);
        }
    }
}

// Mobile Touch Swipe Gesture Support
function setupTouchGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    const target = document.getElementById('questionCard');
    if (!target) return;

    target.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    target.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleGesture();
    }, { passive: true });

    function handleGesture() {
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;

        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 55) {
            if (dx < 0) {
                goToQuestion(currentQuestionIndex + 1);
            } else {
                goToQuestion(currentQuestionIndex - 1);
            }
        }
    }
}

// ================= SHUFFLE QUESTIONS LOGIC =================
function showToast(message) {
    if (!toastNotice) return;
    toastNotice.textContent = message;
    toastNotice.classList.add('show');
    clearTimeout(toastNotice._timer);
    toastNotice._timer = setTimeout(() => {
        toastNotice.classList.remove('show');
    }, 2200);
}

function updateShuffleUI() {
    if (!currentExam) return;
    const isShuffled = !!currentExam.isShuffled;
    if (btnRestoreExam) {
        btnRestoreExam.style.display = isShuffled ? 'inline-flex' : 'none';
    }
    if (shuffleExamLabel) {
        shuffleExamLabel.textContent = isShuffled ? 'Tráo tiếp' : 'Tráo câu hỏi';
    }
    if (btnShuffleCard) {
        if (isShuffled) {
            btnShuffleCard.classList.add('active-bookmark');
            btnShuffleCard.title = 'Câu hỏi đang được tráo ngẫu nhiên. Bấm để tráo lượt khác';
        } else {
            btnShuffleCard.classList.remove('active-bookmark');
            btnShuffleCard.title = 'Tráo đổi ngẫu nhiên vị trí các câu hỏi';
        }
    }
}

function shuffleExamQuestions() {
    if (!currentExam || !currentExam.questions || currentExam.questions.length <= 1) {
        showToast('Không có câu hỏi để tráo');
        return;
    }

    // Backup original order once
    if (!currentExam._originalQuestions) {
        currentExam._originalQuestions = [...currentExam.questions];
    }

    // Fisher-Yates shuffle
    const qList = currentExam.questions;
    for (let i = qList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = qList[i];
        qList[i] = qList[j];
        qList[j] = temp;
    }

    currentExam.isShuffled = true;
    currentQuestionIndex = 0;

    renderQuestionGrid();
    renderCurrentQuestion();
    updateSidebarStats();
    updateShuffleUI();

    showToast(`🔀 Đã tráo đổi vị trí ${qList.length} câu hỏi ngẫu nhiên!`);
}

function restoreOriginalQuestionOrder() {
    if (!currentExam || !currentExam._originalQuestions) return;

    currentExam.questions = [...currentExam._originalQuestions];
    currentExam.isShuffled = false;
    currentQuestionIndex = 0;

    renderQuestionGrid();
    renderCurrentQuestion();
    updateSidebarStats();
    updateShuffleUI();

    showToast('✓ Đã khôi phục thứ tự câu hỏi ban đầu!');
}

function setupGlobalEvents() {
    // Navigation
    if (brandHome) brandHome.addEventListener('click', closeExam);
    if (btnBackToCourse) btnBackToCourse.addEventListener('click', closeExam);

    const prevFn = () => goToQuestion(currentQuestionIndex - 1);
    const nextFn = () => goToQuestion(currentQuestionIndex + 1);

    // Desktop top buttons
    if (btnPrevQ) btnPrevQ.addEventListener('click', prevFn);
    if (btnNextQ) btnNextQ.addEventListener('click', nextFn);

    // Two Flanking Side Buttons (Left / Right of question)
    if (btnFlankPrev) btnFlankPrev.addEventListener('click', prevFn);
    if (btnFlankNext) btnFlankNext.addEventListener('click', nextFn);

    // Mobile Bottom Sticky Navigation Buttons
    if (btnMobPrev) btnMobPrev.addEventListener('click', prevFn);
    if (btnMobNext) btnMobNext.addEventListener('click', nextFn);

    // Mobile Question Grid Drawer
    if (btnMobMatrixToggle) {
        btnMobMatrixToggle.addEventListener('click', () => {
            if (modalMobileMatrix) modalMobileMatrix.style.display = 'flex';
        });
    }
    if (btnCloseMobMatrix) {
        btnCloseMobMatrix.addEventListener('click', () => {
            if (modalMobileMatrix) modalMobileMatrix.style.display = 'none';
        });
    }
    if (modalMobileMatrix) {
        modalMobileMatrix.addEventListener('click', (e) => {
            if (e.target === modalMobileMatrix) {
                modalMobileMatrix.style.display = 'none';
            }
        });
    }

    // Toggle Image Mode: auto -> always -> never -> auto
    if (btnToggleImageMode) {
        btnToggleImageMode.addEventListener('click', () => {
            if (imageDisplayMode === 'auto') {
                imageDisplayMode = 'always';
            } else if (imageDisplayMode === 'always') {
                imageDisplayMode = 'never';
            } else {
                imageDisplayMode = 'auto';
            }
            saveLocalState();
            updateImageModeLabel();
            renderCurrentQuestion();
        });
    }

    // Toggle Collapse Question Grid (Desktop)
    if (btnToggleCollapse) {
        btnToggleCollapse.addEventListener('click', () => {
            if (questionGridContainer.style.display === 'none') {
                questionGridContainer.style.display = 'block';
                btnToggleCollapse.textContent = 'Thu gọn ⌃';
            } else {
                questionGridContainer.style.display = 'none';
                btnToggleCollapse.textContent = 'Mở rộng ⌄';
            }
        });
    }

    // Bookmark Filter
    if (filterAll) {
        filterAll.addEventListener('click', () => {
            filterMode = 'all';
            filterAll.classList.add('active');
            filterSaved.classList.remove('active');
            renderQuestionGrid();
        });
    }

    if (filterSaved) {
        filterSaved.addEventListener('click', () => {
            filterMode = 'saved';
            filterSaved.classList.add('active');
            filterAll.classList.remove('active');
            renderQuestionGrid();
        });
    }

    // Bookmark current question
    if (btnBookmarkQ) {
        btnBookmarkQ.addEventListener('click', () => {
            if (!currentExam) return;
            const q = currentExam.questions[currentQuestionIndex];
            if (!q) return;

            if (savedQuestionIds.has(q.id)) {
                savedQuestionIds.delete(q.id);
            } else {
                savedQuestionIds.add(q.id);
            }

            saveLocalState();
            renderCurrentQuestion();
            renderQuestionGrid();

            if (filterSaved) {
                filterSaved.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    Đã lưu (${savedQuestionIds.size})
                `;
            }
        });
    }

    // Attach Shuffle Listeners
    if (btnShuffleExam) btnShuffleExam.addEventListener('click', shuffleExamQuestions);
    if (btnShuffleCard) btnShuffleCard.addEventListener('click', shuffleExamQuestions);
    if (btnMobShuffleDrawer) btnMobShuffleDrawer.addEventListener('click', () => {
        shuffleExamQuestions();
        if (modalMobileMatrix) modalMobileMatrix.style.display = 'none';
    });
    if (btnRestoreExam) btnRestoreExam.addEventListener('click', restoreOriginalQuestionOrder);

    // Reset Exam
    if (btnResetExam) {
        btnResetExam.addEventListener('click', () => {
            if (!currentExam) return;
            if (confirm(`Bạn có chắc chắn muốn làm lại đề ${currentExam.code}? Toàn bộ lịch sử làm bài của đề này sẽ được xóa.`)) {
                if (examAnswers[currentExam.id]) {
                    delete examAnswers[currentExam.id];
                    saveLocalState();
                }
                currentQuestionIndex = 0;
                renderCurrentQuestion();
                renderQuestionGrid();
                updateSidebarStats();
            }
        });
    }

    // Lightbox modal close
    if (btnCloseLightbox) {
        btnCloseLightbox.addEventListener('click', () => {
            modalDiagramLightbox.style.display = 'none';
        });
    }
    if (modalDiagramLightbox) {
        modalDiagramLightbox.addEventListener('click', (e) => {
            if (e.target === modalDiagramLightbox) {
                modalDiagramLightbox.style.display = 'none';
            }
        });
    }

    // Cheatsheet modal
    if (btnCheatsheet) {
        btnCheatsheet.addEventListener('click', () => {
            modalCheatsheet.style.display = 'flex';
            renderMath(modalCheatsheet);
        });
    }
    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            modalCheatsheet.style.display = 'none';
        });
    }
    window.addEventListener('click', (e) => {
        if (e.target === modalCheatsheet) {
            modalCheatsheet.style.display = 'none';
        }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (!currentExam || practiceView.style.display === 'none') return;
        if (modalCheatsheet.style.display === 'flex' || modalDiagramLightbox.style.display === 'flex' || (modalMobileMatrix && modalMobileMatrix.style.display === 'flex')) {
            if (e.key === 'Escape') {
                modalCheatsheet.style.display = 'none';
                modalDiagramLightbox.style.display = 'none';
                if (modalMobileMatrix) modalMobileMatrix.style.display = 'none';
            }
            return;
        }

        if (e.key === 'ArrowLeft') {
            goToQuestion(currentQuestionIndex - 1);
        } else if (e.key === 'ArrowRight') {
            goToQuestion(currentQuestionIndex + 1);
        } else if (['1', 'a', 'A'].includes(e.key)) {
            const q = currentExam.questions[currentQuestionIndex];
            if (q) handleSelectOption('A', getQuestionData(q));
        } else if (['2', 'b', 'B'].includes(e.key)) {
            const q = currentExam.questions[currentQuestionIndex];
            if (q) handleSelectOption('B', getQuestionData(q));
        } else if (['3', 'c', 'C'].includes(e.key)) {
            const q = currentExam.questions[currentQuestionIndex];
            if (q) handleSelectOption('C', getQuestionData(q));
        } else if (['4', 'd', 'D'].includes(e.key)) {
            const q = currentExam.questions[currentQuestionIndex];
            if (q) handleSelectOption('D', getQuestionData(q));
        }
    });
}
