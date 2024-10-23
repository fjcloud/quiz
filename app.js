class QuizApp {
    constructor() {
        this.quizzes = {};
        this.currentQuiz = null;
        this.questions = [];
        this.currentQuestion = 0;
        this.userAnswers = [];
        this.knownQuizzes = ['quiz1.md', 'quiz2.md', 'quiz3.md'];
        this.setupEventListeners();
        this.loadQuizzes();
    }

    setupEventListeners() {
        document.getElementById('prevBtn').addEventListener('click', () => this.previousQuestion());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextQuestion());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartQuiz());
        document.getElementById('backToListBtn').addEventListener('click', () => this.showQuizList());
        document.getElementById('exitQuizBtn').addEventListener('click', () => this.showQuizList());
    }

    async loadQuizzes() {
        try {
            for (const filename of this.knownQuizzes) {
                try {
                    const response = await fetch(filename);
                    if (response.ok) {
                        const content = await response.text();
                        this.quizzes[filename] = this.parseMarkdown(content);
                    }
                } catch (error) {
                    console.warn(`Failed to load ${filename}:`, error);
                }
            }
            
            this.showQuizList();
        } catch (error) {
            console.error('Error loading quizzes:', error);
            document.getElementById('loadingState').innerHTML = `
                <h1 class="text-2xl font-bold mb-4 text-red-600">Error Loading Quizzes</h1>
                <p>Please ensure markdown files are in the root directory.</p>
            `;
        }
    }

    showQuizList() {
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
                <h3 class="font-bold">${quiz.metadata.title || filename}</h3>
                <p class="text-sm text-gray-600">${quiz.metadata.description || 'No description available'}</p>
                <p class="text-sm text-gray-500 mt-1">${quiz.questions.length} questions</p>
            `;
            button.onclick = () => this.startQuiz(filename);
            quizList.appendChild(button);
        });
    }

    parseMarkdown(content) {
        const sections = content.split('---').filter(section => section.trim());
        
        // Parse quiz metadata (first section)
        const metadata = jsyaml.load(sections[0]);
        
        // Parse questions (remaining sections)
        const questions = sections.slice(1).map(section => {
            const lines = section.trim().split('\n');
            
            // Get metadata and choices
            const metadataText = lines.filter(line => !line.startsWith('-')).join('\n');
            const choices = lines
                .filter(line => line.startsWith('-'))
                .map(line => line.substring(1).trim());
            
            // Parse metadata
            let questionData = {};
            try {
                questionData = jsyaml.load(metadataText);
            } catch (e) {
                console.error('Error parsing question metadata:', e);
                return null;
            }
            
            return {
                topic: questionData.topic || 'Unknown',
                text: questionData.question || 'Missing question',
                choices: choices,
                correctAnswer: Number(questionData.correct) || 0
            };
        }).filter(q => q !== null); // Remove any questions that failed to parse

        return { metadata, questions };
    }

    startQuiz(filename) {
        this.currentQuiz = filename;
        this.questions = this.quizzes[filename].questions;
        this.currentQuestion = 0;
        this.userAnswers = new Array(this.questions.length).fill(null);
        
        document.getElementById('quizSelection').classList.add('hidden');
        document.getElementById('resultsContainer').classList.add('hidden');
        document.getElementById('quizContainer').classList.remove('hidden');
        
        this.displayQuestion();
    }

    displayQuestion() {
        const question = this.questions[this.currentQuestion];

        document.getElementById('questionNumber').textContent = `Question ${this.currentQuestion + 1}/${this.questions.length}`;
        document.getElementById('topic').textContent = question.topic;
        document.getElementById('questionText').textContent = question.text;

        const choicesContainer = document.getElementById('choices');
        choicesContainer.innerHTML = '';

        question.choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.className = `w-full text-left p-3 rounded ${
                this.userAnswers[this.currentQuestion] === index 
                    ? 'bg-blue-100 border-blue-500' 
                    : 'bg-gray-50 hover:bg-gray-100'
            } border`;
            button.textContent = choice;
            button.onclick = () => this.selectAnswer(index);
            choicesContainer.appendChild(button);
        });

        document.getElementById('prevBtn').disabled = this.currentQuestion === 0;
        document.getElementById('nextBtn').textContent = 
            this.currentQuestion === this.questions.length - 1 ? 'Finish' : 'Next';
    }

    selectAnswer(index) {
        this.userAnswers[this.currentQuestion] = index;
        this.displayQuestion();
    }

    previousQuestion() {
        if (this.currentQuestion > 0) {
            this.currentQuestion--;
            this.displayQuestion();
        }
    }

    nextQuestion() {
        if (this.currentQuestion < this.questions.length - 1) {
            this.currentQuestion++;
            this.displayQuestion();
        } else {
            this.showResults();
        }
    }

    showResults() {
        document.getElementById('quizContainer').classList.add('hidden');
        document.getElementById('resultsContainer').classList.remove('hidden');

        const correctAnswers = this.userAnswers.filter((answer, index) => 
            answer === this.questions[index].correctAnswer
        ).length;

        const scorePercentage = ((correctAnswers / this.questions.length) * 100).toFixed(1);
        document.getElementById('score').textContent = 
            `Your Score: ${correctAnswers}/${this.questions.length} (${scorePercentage}%)`;

        const incorrectContainer = document.getElementById('incorrectAnswers');
        incorrectContainer.innerHTML = '<h3 class="font-bold mb-2">Incorrect Answers:</h3>';

        this.questions.forEach((question, index) => {
            if (this.userAnswers[index] !== question.correctAnswer) {
                const div = document.createElement('div');
                div.className = 'mb-4 p-3 bg-red-50 rounded';
                div.innerHTML = `
                    <p class="font-bold">${question.text}</p>
                    <p class="text-red-600">Your answer: ${question.choices[this.userAnswers[index]]}</p>
                    <p class="text-green-600">Correct answer: ${question.choices[question.correctAnswer]}</p>
                `;
                incorrectContainer.appendChild(div);
            }
        });
    }

    restartQuiz() {
        document.getElementById('resultsContainer').classList.add('hidden');
        this.currentQuestion = 0;
        this.userAnswers = new Array(this.questions.length).fill(null);
        document.getElementById('quizContainer').classList.remove('hidden');
        this.displayQuestion();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});
