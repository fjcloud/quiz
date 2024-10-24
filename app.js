class QuizApp {
    constructor() {
        this.quizzes = {};
        this.currentQuiz = null;
        this.questions = [];
        this.originalQuestions = [];
        this.currentQuestion = 0;
        this.userAnswers = [];
        this.maxTimePerQuestion = 30;
        this.timeRemaining = 0;
        this.questionStartTime = 0;
        this.questionTimes = [];
        this.timerInterval = null;
        this.questionMapping = [];
        this.randomizedChoices = [];
        this.submittedAnswers = new Set();
        
        this.setupEventListeners();
        this.initializeApp();
    }

    setupEventListeners() {
        document.getElementById('restartBtn').addEventListener('click', () => this.restartQuiz());
        document.getElementById('backToListBtn').addEventListener('click', () => this.showQuizList());
        document.getElementById('exitQuizBtn').addEventListener('click', () => this.showQuizList());
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    randomizeQuestions() {
        this.originalQuestions = [...this.questions];
        const indices = Array.from({ length: this.questions.length }, (_, i) => i);
        this.questionMapping = this.shuffleArray(indices);
        this.questions = this.questionMapping.map(index => this.originalQuestions[index]);
    }

    randomizeAllChoices() {
        this.randomizedChoices = this.questions.map(question => {
            const choicesWithIndices = question.choices.map((choice, index) => ({ 
                choice, 
                originalIndex: index 
            }));
            return this.shuffleArray(choicesWithIndices);
        });
    }

    async initializeApp() {
        try {
            await this.loadQuizzes();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to load quizzes. Please try again.');
        }
    }

    async loadQuizzes() {
        try {
            const manifestResponse = await fetch('/data/manifest.yaml');
            if (!manifestResponse.ok) {
                throw new Error('Failed to load quiz manifest');
            }
            
            const manifestContent = await manifestResponse.text();
            const manifest = jsyaml.load(manifestContent);
            
            if (!manifest.quizzes || !Array.isArray(manifest.quizzes)) {
                throw new Error('Invalid manifest format');
            }

            const sortedQuizzes = [...manifest.quizzes].sort((a, b) => 
                (a.order || 0) - (b.order || 0)
            );

            for (const quizInfo of sortedQuizzes) {
                try {
                    const fileResponse = await fetch(`/data/${quizInfo.filename}`);
                    if (fileResponse.ok) {
                        const content = await fileResponse.text();
                        const quizData = jsyaml.load(content);
                        if (this.isValidQuizData(quizData)) {
                            this.quizzes[quizInfo.filename] = quizData;
                        } else {
                            console.warn(`Invalid quiz data in ${quizInfo.filename}`);
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to load ${quizInfo.filename}:`, error);
                }
            }
            
            if (Object.keys(this.quizzes).length === 0) {
                throw new Error('No valid quiz files found');
            }
            
            this.showQuizList();
        } catch (error) {
            console.error('Error loading quizzes:', error);
            this.showError(`Error Loading Quizzes: ${error.message}`);
        }
    }

    showError(message) {
        document.getElementById('loadingState').innerHTML = `
            <h1 class="text-2xl font-bold mb-4 text-red-600">Error</h1>
            <p>${message}</p>
            <p class="text-sm text-gray-600 mt-2">Please check your connection and try again.</p>
        `;
    }

    isValidQuizData(data) {
        return (
            data &&
            typeof data.title === 'string' &&
            typeof data.description === 'string' &&
            Array.isArray(data.questions) &&
            data.questions.every(q => 
                q.topic &&
                q.question &&
                typeof q.correct === 'number' &&
                Array.isArray(q.choices) &&
                q.choices.length > 0
            )
        );
    }

    showQuizList() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('quizContainer').classList.add('hidden');
        document.getElementById('resultsContainer').classList.add('hidden');
        
        const quizSelection = document.getElementById('quizSelection');
        quizSelection.classList.remove('hidden');
        
        const quizList = document.getElementById('quizList');
        quizList.innerHTML = '';
        
        Object.entries(this.quizzes).forEach(([filename, quiz]) => {
            const button = document.createElement('button');
            button.className = 'w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded border mb-2';
            button.innerHTML = `
                <h3 class="font-bold">${quiz.title}</h3>
                <p class="text-sm text-gray-600">${quiz.description}</p>
                <p class="text-sm text-gray-500 mt-1">${quiz.questions.length} questions</p>
            `;
            button.onclick = () => this.startQuiz(filename);
            quizList.appendChild(button);
        });
    }

    startQuiz(filename) {
        this.currentQuiz = filename;
        this.questions = this.quizzes[filename].questions;
        this.randomizeQuestions();
        this.randomizeAllChoices();
        this.currentQuestion = 0;
        this.userAnswers = new Array(this.questions.length).fill(null);
        this.questionTimes = new Array(this.questions.length).fill(0);
        this.submittedAnswers = new Set();
        
        document.getElementById('quizSelection').classList.add('hidden');
        document.getElementById('resultsContainer').classList.add('hidden');
        document.getElementById('quizContainer').classList.remove('hidden');
        
        this.displayQuestion();
        this.startQuestionTimer();
    }

    startQuestionTimer() {
        this.timeRemaining = this.maxTimePerQuestion;
        this.questionStartTime = Date.now();
        this.updateTimerDisplay();

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        this.timerInterval = setInterval(() => {
            this.timeRemaining = Math.max(0, this.maxTimePerQuestion - 
                Math.floor((Date.now() - this.questionStartTime) / 1000));
            this.updateTimerDisplay();

            if (this.timeRemaining === 0) {
                clearInterval(this.timerInterval);
                this.handleTimeUp();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const timerDisplay = document.getElementById('timerDisplay');
        const timerBar = document.getElementById('timerBar');
        
        if (timerDisplay && timerBar) {
            const seconds = this.timeRemaining;
            const percentage = (seconds / this.maxTimePerQuestion) * 100;
            
            const colorClass = seconds < 10 ? 'text-red-600' : 'text-gray-600';
            timerDisplay.className = `text-lg font-bold ${colorClass} ${seconds < 10 ? 'timer-pulse' : ''}`;
            timerDisplay.textContent = `${seconds}s`;
            
            timerBar.style.width = `${percentage}%`;
            timerBar.className = `h-2 rounded-full transition-all duration-1000 ${
                seconds < 10 ? 'bg-red-600' : 'bg-blue-600'
            }`;
        }
    }

    handleTimeUp() {
        if (!this.submittedAnswers.has(this.currentQuestion)) {
            if (this.userAnswers[this.currentQuestion] === null) {
                this.userAnswers[this.currentQuestion] = -1;
            }
            this.submitAnswer();
        }
    }

    displayQuestion() {
        const question = this.questions[this.currentQuestion];
        const randomizedChoicesForQuestion = this.randomizedChoices[this.currentQuestion];
        const isSubmitted = this.submittedAnswers.has(this.currentQuestion);

        document.getElementById('questionNumber').textContent = `Question ${this.currentQuestion + 1}/${this.questions.length}`;
        document.getElementById('topic').textContent = question.topic;
        document.getElementById('questionText').textContent = question.question;

        const container = document.getElementById('choices');
        container.innerHTML = '';
        container.className = 'flex gap-4';

        const choicesColumn = document.createElement('div');
        choicesColumn.className = 'flex-grow space-y-2';

        randomizedChoicesForQuestion.forEach(({ choice, originalIndex }) => {
            const button = document.createElement('button');
            button.className = `w-full text-left p-3 rounded ${
                this.userAnswers[this.currentQuestion] === originalIndex 
                    ? 'bg-blue-100 border-blue-500' 
                    : 'bg-gray-50 hover:bg-gray-100'
            } border`;
            button.textContent = choice;
            button.onclick = () => this.selectAnswer(originalIndex);
            button.disabled = isSubmitted;
            choicesColumn.appendChild(button);
        });

        container.appendChild(choicesColumn);

        if (!isSubmitted) {
            const submitColumn = document.createElement('div');
            submitColumn.className = 'flex flex-col justify-center';
            
            const submitButton = document.createElement('button');
            submitButton.className = 'px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300';
            submitButton.textContent = 'Submit';
            submitButton.disabled = this.userAnswers[this.currentQuestion] === null;
            submitButton.onclick = () => this.submitAnswer();
            
            submitColumn.appendChild(submitButton);
            container.appendChild(submitColumn);
        }
    }

    selectAnswer(index) {
        this.userAnswers[this.currentQuestion] = index;
        this.displayQuestion();
    }

    submitAnswer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        const timeTaken = Math.min(
            this.maxTimePerQuestion,
            Math.floor((Date.now() - this.questionStartTime) / 1000)
        );
        this.questionTimes[this.currentQuestion] = timeTaken;
        
        this.submittedAnswers.add(this.currentQuestion);
        
        if (this.currentQuestion < this.questions.length - 1) {
            this.currentQuestion++;
            this.displayQuestion();
            this.startQuestionTimer();
        } else {
            this.showResults();
        }
    }

    calculateQuestionScore(questionIndex) {
        const baseScore = 100;
        const timeBonusMax = 50;
        
        if (this.userAnswers[questionIndex] === -1 || 
            this.userAnswers[questionIndex] !== this.questions[questionIndex].correct) {
            return 0;
        }

        const timeTaken = this.questionTimes[questionIndex];
        const timeBonus = Math.max(0, Math.floor(
            timeBonusMax * (1 - timeTaken / this.maxTimePerQuestion)
        ));

        return baseScore + timeBonus;
    }

    showResults() {
        document.getElementById('quizContainer').classList.add('hidden');
        document.getElementById('resultsContainer').classList.remove('hidden');

        let totalScore = 0;
        const maxPossibleScore = this.questions.length * 150;

        const validTimes = this.questionTimes.filter(time => time > 0);
        const averageTime = validTimes.length > 0 
            ? (validTimes.reduce((a, b) => a + b, 0) / validTimes.length).toFixed(1)
            : 0;
        const fastestTime = validTimes.length > 0 
            ? Math.min(...validTimes)
            : 0;

        this.questions.forEach((_, index) => {
            totalScore += this.calculateQuestionScore(index);
        });

        const scorePercentage = ((totalScore / maxPossibleScore) * 100).toFixed(1);
        
        document.getElementById('score').innerHTML = `
            <div class="text-2xl font-bold mb-2">Final Score: ${scorePercentage}%</div>
            <div class="text-lg text-gray-600">Total Points: ${totalScore}/${maxPossibleScore}</div>
            <div class="mt-6">
                <input type="text" 
                    id="nicknameInput" 
                    placeholder="Enter your nickname" 
                    class="px-4 py-2 border rounded mr-2 focus:outline-none focus:border-blue-500"
                    maxlength="20"
                />
                <button 
                    id="submitScoreBtn" 
                    class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                    onclick="quizApp.submitScore(${totalScore})"
                >
                    Submit to Leaderboard
                </button>
                <div id="submitStatus" class="mt-2 text-sm"></div>
            </div>
        `;

        document.getElementById('timeStats').innerHTML = `
            <div>Average Time: ${averageTime}s per question</div>
            <div>Fastest Answer: ${fastestTime}s</div>
        `;

        const incorrectContainer = document.getElementById('incorrectAnswers');
        incorrectContainer.innerHTML = '<h3 class="font-bold mb-4 text-lg">Question Details:</h3>';

        this.originalQuestions.forEach((question, originalIndex) => {
            const randomizedIndex = this.questionMapping.indexOf(originalIndex);
            const userAnswer = this.userAnswers[randomizedIndex];
            
            const div = document.createElement('div');
            div.className = 'mb-4 p-4 rounded ' + 
                (userAnswer === question.correct ? 'bg-green-50' : 'bg-red-50');
            
            const score = this.calculateQuestionScore(randomizedIndex);
            const timeTaken = this.questionTimes[randomizedIndex];

            const userChoiceText = userAnswer === -1 ? 'Time Out' : 
                (userAnswer !== null ? question.choices[userAnswer] : 'No answer');
            
            div.innerHTML = `
                <p class="font-bold">Question ${originalIndex+ 1}: ${question.question}</p>
                <p class="${userAnswer === question.correct ? 'text-green-600' : 'text-red-600'}">
                    Your answer: ${userChoiceText}
                </p>
                ${userAnswer !== question.correct ? 
                    `<p class="text-green-600">Correct answer: ${question.choices[question.correct]}</p>` : ''}
                <p class="text-sm text-gray-600 mt-2">
                    Time taken: ${timeTaken}s | Points earned: ${score}
                    ${score > 100 ? ` (includes ${score - 100} speed bonus)` : ''}
                </p>
            `;
            incorrectContainer.appendChild(div);
        });
    }

async submitScore(score) {
        const nicknameInput = document.getElementById('nicknameInput');
        const submitBtn = document.getElementById('submitScoreBtn');
        const statusDiv = document.getElementById('submitStatus');
        
        const nickname = nicknameInput.value.trim();
        
        if (!nickname) {
            statusDiv.textContent = 'Please enter a nickname';
            statusDiv.className = 'mt-2 text-sm text-red-500';
            return;
        }

        try {
            submitBtn.disabled = true;
            nicknameInput.disabled = true;
            statusDiv.textContent = 'Submitting score...';
            statusDiv.className = 'mt-2 text-sm text-gray-500';

            const response = await fetch('https://leaderboard-worker.fj-9d1.workers.dev/score', {
                method: 'POST',
                mode: 'cors', // Explicitly set CORS mode
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    player: nickname,
                    score: score
                })
            });

            // If the response is ok, assume success even if we can't read the response
            if (response.ok) {
                statusDiv.textContent = 'Score submitted successfully!';
                statusDiv.className = 'mt-2 text-sm text-green-500';
                submitBtn.style.display = 'none';
                nicknameInput.disabled = true;
                return;
            }

            // If we get here, there was an error
            throw new Error('Failed to submit score');

        } catch (error) {
            console.error('Error submitting score:', error);
            
            // Check if it's a CORS error
            if (error instanceof TypeError && error.message.includes('CORS')) {
                statusDiv.textContent = 'Unable to submit score due to CORS policy. Please check your connection or try again later.';
            } else {
                statusDiv.textContent = 'Failed to submit score. Please try again.';
            }
            
            statusDiv.className = 'mt-2 text-sm text-red-500';
            submitBtn.disabled = false;
            nicknameInput.disabled = false;
        }
    }

    restartQuiz() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        this.currentQuestion = 0;
        this.userAnswers = new Array(this.questions.length).fill(null);
        this.questionTimes = new Array(this.questions.length).fill(0);
        this.submittedAnswers = new Set();
        this.randomizeQuestions();
        this.randomizeAllChoices();
        document.getElementById('resultsContainer').classList.add('hidden');
        document.getElementById('quizContainer').classList.remove('hidden');
        this.displayQuestion();
        this.startQuestionTimer();
    }
}

// Initialize the quiz app when the DOM is fully loaded and make it globally available
document.addEventListener('DOMContentLoaded', () => {
    window.quizApp = new QuizApp();
});
