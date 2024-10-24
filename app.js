class QuizApp {
    constructor() {
        this.quizzes = {};
        this.currentQuiz = null;
        this.questions = [];
        this.currentQuestion = 0;
        this.userAnswers = [];
        // Timer-related properties
        this.maxTimePerQuestion = 30; // seconds
        this.timeRemaining = 0;
        this.questionStartTime = 0;
        this.questionTimes = []; // Store time taken for each question
        this.timerInterval = null;
        
        this.setupEventListeners();
        this.initializeApp();
    }

    setupEventListeners() {
        document.getElementById('prevBtn').addEventListener('click', () => this.previousQuestion());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextQuestion());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartQuiz());
        document.getElementById('backToListBtn').addEventListener('click', () => this.showQuizList());
        document.getElementById('exitQuizBtn').addEventListener('click', () => this.showQuizList());
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
            // First load the manifest
            const manifestResponse = await fetch('/data/manifest.yaml');
            if (!manifestResponse.ok) {
                throw new Error('Failed to load quiz manifest');
            }
            
            const manifestContent = await manifestResponse.text();
            const manifest = jsyaml.load(manifestContent);
            
            if (!manifest.quizzes || !Array.isArray(manifest.quizzes)) {
                throw new Error('Invalid manifest format');
            }

            // Sort quizzes by order if present
            const sortedQuizzes = [...manifest.quizzes].sort((a, b) => 
                (a.order || 0) - (b.order || 0)
            );

            // Load each quiz file listed in the manifest
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
        this.currentQuestion = 0;
        this.userAnswers = new Array(this.questions.length).fill(null);
        this.questionTimes = new Array(this.questions.length).fill(0);
        
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
            
            // Update timer text
            const colorClass = seconds < 10 ? 'text-red-600' : 'text-gray-600';
            timerDisplay.className = `text-lg font-bold ${colorClass} ${seconds < 10 ? 'timer-pulse' : ''}`;
            timerDisplay.textContent = `${seconds}s`;
            
            // Update progress bar
            timerBar.style.width = `${percentage}%`;
            timerBar.className = `h-2 rounded-full transition-all duration-1000 ${
                seconds < 10 ? 'bg-red-600' : 'bg-blue-600'
            }`;
        }
    }

    handleTimeUp() {
        if (this.userAnswers[this.currentQuestion] === null) {
            this.selectAnswer(-1); // -1 indicates timeout
            this.nextQuestion();
        }
    }

    displayQuestion() {
        const question = this.questions[this.currentQuestion];

        document.getElementById('questionNumber').textContent = `Question ${this.currentQuestion + 1}/${this.questions.length}`;
        document.getElementById('topic').textContent = question.topic;
        document.getElementById('questionText').textContent = question.question;

        const choicesContainer = document.getElementById('choices');
        choicesContainer.innerHTML = '';

        const choicesDiv = document.createElement('div');
        choicesDiv.className = 'space-y-2';

        question.choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.className = `w-full text-left p-3 rounded ${
                this.userAnswers[this.currentQuestion] === index 
                    ? 'bg-blue-100 border-blue-500' 
                    : 'bg-gray-50 hover:bg-gray-100'
            } border`;
            button.textContent = choice;
            button.onclick = () => this.selectAnswer(index);
            choicesDiv.appendChild(button);
        });

        choicesContainer.appendChild(choicesDiv);

        const nextBtn = document.getElementById('nextBtn');
        nextBtn.textContent = this.currentQuestion === this.questions.length - 1 ? 'Finish' : 'Next';
        document.getElementById('prevBtn').disabled = this.currentQuestion === 0;
        nextBtn.disabled = this.userAnswers[this.currentQuestion] === null;
    }

    selectAnswer(index) {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        this.userAnswers[this.currentQuestion] = index;
        const timeTaken = Math.min(
            this.maxTimePerQuestion,
            Math.floor((Date.now() - this.questionStartTime) / 1000)
        );
        this.questionTimes[this.currentQuestion] = timeTaken;
        this.displayQuestion();
    }

    calculateQuestionScore(questionIndex) {
        const baseScore = 100;
        const timeBonusMax = 50;
        
        // If timed out or wrong answer, return 0
        if (this.userAnswers[questionIndex] === -1 || 
            this.userAnswers[questionIndex] !== this.questions[questionIndex].correct) {
            return 0;
        }

        // Calculate time bonus
        const timeTaken = this.questionTimes[questionIndex];
        const timeBonus = Math.max(0, Math.floor(
            timeBonusMax * (1 - timeTaken / this.maxTimePerQuestion)
        ));

        return baseScore + timeBonus;
    }

    previousQuestion() {
        if (this.currentQuestion > 0) {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
            }
            this.currentQuestion--;
            this.displayQuestion();
            this.startQuestionTimer();
        }
    }

    nextQuestion() {
        if (this.currentQuestion < this.questions.length - 1) {
            this.currentQuestion++;
            this.displayQuestion();
            this.startQuestionTimer();
        } else {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
            }
            this.showResults();
        }
    }

    showResults() {
        document.getElementById('quizContainer').classList.add('hidden');
        document.getElementById('resultsContainer').classList.remove('hidden');

        let totalScore = 0;
        const maxPossibleScore = this.questions.length * 150; // 100 base + 50 max time bonus

        // Calculate statistics
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
        `;

        document.getElementById('timeStats').innerHTML = `
            <div>Average Time: ${averageTime}s per question</div>
            <div>Fastest Answer: ${fastestTime}s</div>
        `;

        const incorrectContainer = document.getElementById('incorrectAnswers');
        incorrectContainer.innerHTML = '<h3 class="font-bold mb-4 text-lg">Question Details:</h3>';

        this.questions.forEach((question, index) => {
            const div = document.createElement('div');
            div.className = 'mb-4 p-4 rounded ' + 
                (this.userAnswers[index] === question.correct ? 'bg-green-50' : 'bg-red-50');
            
            const score = this.calculateQuestionScore(index);
            const timeTaken = this.questionTimes[index];
            
            div.innerHTML = `
                <p class="font-bold">Question ${index + 1}: ${question.question}</p>
                <p class="${this.userAnswers[index] === question.correct ? 'text-green-600' : 'text-red-600'}">
                    Your answer: ${this.userAnswers[index] === -1 ? 'Time Out' : 
                        question.choices[this.userAnswers[index]]}
                </p>
                ${this.userAnswers[index] !== question.correct ? 
                    `<p class="text-green-600">Correct answer: ${question.choices[question.correct]}</p>` : ''}
                <p class="text-sm text-gray-600 mt-2">
                    Time taken: ${timeTaken}s | Points earned: ${score}
                    ${score > 100 ? ` (includes ${score - 100} speed bonus)` : ''}
                </p>
            `;
            incorrectContainer.appendChild(div);
        });
    }

    restartQuiz() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        this.currentQuestion = 0;
        this.userAnswers = new Array(this.questions.length).fill(null);
        this.questionTimes = new Array(this.questions.length).fill(0);
        document.getElementById('resultsContainer').classList.add('hidden');
        document.getElementById('quizContainer').classList.remove('hidden');
        this.displayQuestion();
        this.startQuestionTimer();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});
